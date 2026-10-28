using System.Globalization;
using Microsoft.AspNetCore.Http;
using MyMBG.Data;
using Npgsql;

namespace MyMBG.Endpoints;

public static class ProduksiEndpoints
{
    public static RouteGroupBuilder MapProduksiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/produksi");

        /// <summary>
        /// Creates sesi_produksi, inserts penggunaan_bahan from resep_bahan scaled by porsi,
        /// and optionally updates status to Selesai so fn_kurangi_stok_produksi deducts stock.
        /// </summary>
        group.MapPost("/", async (ProduksiCreateRequest body, NpgsqlDataSource dataSource, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (body.JumlahPorsiDiproduksi <= 0)
            {
                return Results.BadRequest(new { message = "Jumlah porsi harus lebih dari 0." });
            }

            if (body.CreatedBy == Guid.Empty)
            {
                return Results.BadRequest(new { message = "Pengguna (created_by) wajib diisi." });
            }

            var statusInput = string.IsNullOrWhiteSpace(body.Status) ? "Direncanakan" : body.Status.Trim();
            if (!AllowedStatuses.Contains(statusInput))
            {
                return Results.BadRequest(new { message = "Status produksi tidak valid." });
            }

            var mustFinalize =
                (body.KurangiStokSekarang || string.Equals(statusInput, "Selesai", StringComparison.OrdinalIgnoreCase))
                && !string.Equals(statusInput, "Dibatalkan", StringComparison.OrdinalIgnoreCase);

            var insertStatus = mustFinalize ? "Direncanakan" : statusInput;

            await using var conn = await dataSource.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();

            try
            {
                int resepPorsi;
                await using (var cmdResep = new NpgsqlCommand(
                                   """
                                   SELECT jumlah_porsi
                                   FROM resep
                                   WHERE id = @id
                                   LIMIT 1
                                   """,
                                   conn,
                                   tx))
                {
                    cmdResep.Parameters.AddWithValue("id", body.ResepId);
                    var scalar = await cmdResep.ExecuteScalarAsync();
                    if (scalar is null or DBNull)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { message = "Resep tidak ditemukan." });
                    }

                    resepPorsi = Convert.ToInt32(scalar, CultureInfo.InvariantCulture);
                }

                if (resepPorsi <= 0)
                {
                    await tx.RollbackAsync();
                    return Results.BadRequest(new { message = "Acuan porsi resep tidak valid." });
                }

                var sesiId = Guid.NewGuid();
                var factor = (decimal)body.JumlahPorsiDiproduksi / resepPorsi;

                await using (var cmdInsert = new NpgsqlCommand(
                                   """
                                   INSERT INTO sesi_produksi (
                                       id, resep_id, created_by, jumlah_porsi_diproduksi, status,
                                       tanggal_produksi, catatan)
                                   VALUES (
                                       @id, @resep_id, @created_by, @jumlah, @status,
                                       COALESCE(@tanggal, CURRENT_DATE), @catatan)
                                   """,
                                   conn,
                                   tx))
                {
                    cmdInsert.Parameters.AddWithValue("id", sesiId);
                    cmdInsert.Parameters.AddWithValue("resep_id", body.ResepId);
                    cmdInsert.Parameters.AddWithValue("created_by", body.CreatedBy);
                    cmdInsert.Parameters.AddWithValue("jumlah", body.JumlahPorsiDiproduksi);
                    cmdInsert.Parameters.Add(new NpgsqlParameter("status", insertStatus) { DataTypeName = "public.status_produksi" });
                    if (string.IsNullOrWhiteSpace(body.TanggalProduksi))
                    {
                        cmdInsert.Parameters.AddWithValue("tanggal", DBNull.Value);
                    }
                    else if (DateOnly.TryParse(body.TanggalProduksi, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                    {
                        cmdInsert.Parameters.AddWithValue("tanggal", d);
                    }
                    else
                    {
                        cmdInsert.Parameters.AddWithValue("tanggal", DBNull.Value);
                    }

                    cmdInsert.Parameters.AddWithValue(
                        "catatan",
                        string.IsNullOrWhiteSpace(body.Catatan) ? (object)DBNull.Value : body.Catatan.Trim());
                    await cmdInsert.ExecuteNonQueryAsync();
                }

                var bahanRows = new List<(Guid bahanBakuId, decimal jumlah, string satuan)>();
                await using (var cmdBahan = new NpgsqlCommand(
                                   """
                                   SELECT rb.bahan_baku_id, rb.jumlah, bb.satuan
                                   FROM resep_bahan rb
                                   JOIN bahan_baku bb ON bb.id = rb.bahan_baku_id
                                   WHERE rb.resep_id = @resep_id
                                   """,
                                   conn,
                                   tx))
                {
                    cmdBahan.Parameters.AddWithValue("resep_id", body.ResepId);
                    await using (var reader = await cmdBahan.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            bahanRows.Add((
                                reader.GetGuid(0),
                                reader.GetDecimal(1),
                                reader.IsDBNull(2) ? "unit" : reader.GetString(2)));
                        }
                    }
                }

                if (bahanRows.Count == 0)
                {
                    // A session on an ingredient-less recipe would record 0 cost.
                    await tx.RollbackAsync();
                    return Results.BadRequest(new { message = "Resep belum memiliki bahan. Tambahkan bahan baku pada resep terlebih dahulu agar biaya produksi tercatat." });
                }

                foreach (var row in bahanRows)
                {
                    var qty = decimal.Round(row.jumlah * factor, 3, MidpointRounding.AwayFromZero);
                    if (qty <= 0)
                    {
                        continue;
                    }

                    await using var cmdPb = new NpgsqlCommand(
                        """
                        INSERT INTO penggunaan_bahan (sesi_produksi_id, bahan_baku_id, jumlah_digunakan, jumlah_estimasi, satuan)
                        VALUES (@sesi, @bahan, @qty, @qty, @satuan)
                        """,
                        conn,
                        tx);
                    cmdPb.Parameters.AddWithValue("sesi", sesiId);
                    cmdPb.Parameters.AddWithValue("bahan", row.bahanBakuId);
                    cmdPb.Parameters.AddWithValue("qty", qty);
                    cmdPb.Parameters.AddWithValue("satuan", row.satuan);
                    await cmdPb.ExecuteNonQueryAsync();
                }

                if (mustFinalize)
                {
                    var finishError = await ValidateFinishCoreAsync(conn, tx, sesiId);
                    if (finishError != null)
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { message = finishError });
                    }

                    await using var cmdFin = new NpgsqlCommand(
                        """
                        UPDATE sesi_produksi
                        SET status = CAST('Selesai' AS status_produksi)
                        WHERE id = @id
                        """,
                        conn,
                        tx);
                    cmdFin.Parameters.AddWithValue("id", sesiId);
                    await cmdFin.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();

                return Results.Ok(new
                {
                    id = sesiId.ToString(),
                    kurangiStok = mustFinalize,
                    message = mustFinalize
                        ? "Produksi disimpan dan stok bahan telah dikurangi sesuai resep."
                        : "Produksi disimpan. Rencana pemakaian bahan tercatat; kurangi stok dengan mengubah status menjadi Selesai."
                });
            }
            catch (PostgresException ex)
            {
                await tx.RollbackAsync();
                return Results.Json(
                    new { message = ex.Message },
                    statusCode: StatusCodes.Status400BadRequest);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return Results.Json(
                    new { message = ex.Message },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        return group;
    }

    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Direncanakan",
        "Berlangsung",
        "Selesai",
        "Dibatalkan"
    };

    /// <summary>
    /// A session can only be finished when at least one bahan-baku usage row
    /// exists (otherwise the financial report would record a 0 production cost)
    /// and when the stock on hand covers every planned deduction.
    /// Returns an error message, or null when the session can be finished.
    /// </summary>
    internal static async Task<string?> ValidateFinishAsync(NpgsqlDataSource dataSource, string sesiProduksiId)
    {
        if (!Guid.TryParse(sesiProduksiId, out var sesiId))
        {
            return null;
        }

        await using var conn = await dataSource.OpenConnectionAsync();
        return await ValidateFinishCoreAsync(conn, null, sesiId);
    }

    internal static async Task<string?> ValidateFinishCoreAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, Guid sesiId)
    {
        await using var cmdCount = new NpgsqlCommand(
            "SELECT COUNT(*) FROM penggunaan_bahan WHERE sesi_produksi_id = @sesi", conn, tx);
        cmdCount.Parameters.AddWithValue("sesi", sesiId);
        var count = Convert.ToInt32(await cmdCount.ExecuteScalarAsync());
        if (count == 0)
        {
            return "Sesi produksi belum memiliki catatan pemakaian bahan, sehingga biaya produksi akan tercatat 0. Tambahkan bahan baku pada resep, lalu buat sesi produksi baru.";
        }

        var shortages = new List<string>();
        await using (var cmdShort = new NpgsqlCommand(
            """
            SELECT bb.nama_bahan, pb.jumlah_digunakan, bb.stok_saat_ini, COALESCE(bb.satuan, 'unit')
            FROM penggunaan_bahan pb
            JOIN bahan_baku bb ON bb.id = pb.bahan_baku_id
            WHERE pb.sesi_produksi_id = @sesi AND pb.jumlah_digunakan > bb.stok_saat_ini
            ORDER BY bb.nama_bahan
            """, conn, tx))
        {
            cmdShort.Parameters.AddWithValue("sesi", sesiId);
            await using var reader = await cmdShort.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var nama = reader.GetString(0);
                var butuh = reader.GetDecimal(1);
                var ada = reader.GetDecimal(2);
                var satuan = reader.GetString(3);
                shortages.Add($"{nama} — dibutuhkan {butuh:0.###} {satuan}, stok tersisa {ada:0.###} {satuan}");
            }
        }

        if (shortages.Count > 0)
        {
            return "Stok bahan tidak cukup untuk menyelesaikan produksi: " + string.Join("; ", shortages) + ". Tambah stok bahan terlebih dahulu.";
        }

        return null;
    }

    public sealed record ProduksiCreateRequest(
        Guid ResepId,
        int JumlahPorsiDiproduksi,
        string? TanggalProduksi,
        string? Catatan,
        string? Status,
        Guid CreatedBy,
        bool KurangiStokSekarang);
}
