using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using MyMBG.Data;
using Npgsql;

namespace MyMBG.Endpoints;

public static class DistribusiEndpoints
{
    public static RouteGroupBuilder MapDistribusiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/distribusi");

        /// <summary>
        /// Production sessions available as the source of a new distribution:
        /// only sessions with remaining portions left (all portions shipped =>
        /// excluded), each with the shippable portion count for the UI.
        /// </summary>
        group.MapGet("/available-productions", async (NpgsqlDataSource dataSource, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            await using var conn = await dataSource.OpenConnectionAsync();
            var sql =
                """
                SELECT
                    sp.id,
                    sp.kode_produksi,
                    r.nama_menu,
                    sp.tanggal_produksi,
                    sp.status::text,
                    sp.jumlah_porsi_diproduksi,
                    COALESCE(SUM(d.jumlah_porsi), 0),
                    sp.jumlah_porsi_diproduksi - COALESCE(SUM(d.jumlah_porsi), 0)
                FROM sesi_produksi sp
                LEFT JOIN resep r ON r.id = sp.resep_id
                LEFT JOIN distribusi d ON d.sesi_produksi_id = sp.id
                WHERE sp.status <> 'Dibatalkan'
                GROUP BY sp.id, sp.kode_produksi, r.nama_menu, sp.tanggal_produksi, sp.status, sp.jumlah_porsi_diproduksi
                HAVING sp.jumlah_porsi_diproduksi - COALESCE(SUM(d.jumlah_porsi), 0) > 0
                ORDER BY sp.tanggal_produksi DESC NULLS LAST, sp.kode_produksi
                """;
            await using var cmd = new NpgsqlCommand(sql, conn);
            var rows = new List<object>();
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add(new
                {
                    id = reader.GetGuid(0).ToString(),
                    kode_produksi = reader.IsDBNull(1) ? null : reader.GetString(1),
                    nama_menu = reader.IsDBNull(2) ? null : reader.GetString(2),
                    tanggal_produksi = reader.IsDBNull(3) ? null : (DateTime?)reader.GetFieldValue<DateTime>(3),
                    status = reader.GetString(4),
                    porsi_diproduksi = reader.GetDecimal(5),
                    porsi_terkirim = reader.GetDecimal(6),
                    sisa_porsi = reader.GetDecimal(7),
                });
            }
            return Results.Ok(rows);
        });

        /// <summary>
        /// Mark distribusi as complete with biaya_distribusi (distribution cost)
        /// This updates the distribusi record and triggers creation of keuangan entry
        /// </summary>
        group.MapPost("/{id}/complete", async (string id, DistribusiCompleteRequest body, NpgsqlDataSource dataSource) =>
        {
            if (!Guid.TryParse(id, out var distribusiId))
            {
                return Results.BadRequest(new { message = "ID format tidak valid." });
            }

            if (body.BiayaDistribusi < 0)
            {
                return Results.BadRequest(new { message = "Biaya distribusi tidak boleh negatif." });
            }

            await using var conn = await dataSource.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();

            try
            {
                // Check if distribusi exists
                await using (var cmdCheck = new NpgsqlCommand(
                    "SELECT id FROM public.distribusi WHERE id = @id",
                    conn,
                    tx))
                {
                    cmdCheck.Parameters.AddWithValue("id", distribusiId);
                    var result = await cmdCheck.ExecuteScalarAsync();
                    if (result is null or DBNull)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { message = "Data distribusi tidak ditemukan." });
                    }
                }

                // Update distribusi with status and biaya
                await using (var cmdUpdate = new NpgsqlCommand(
                    """
                    UPDATE public.distribusi
                    SET status = CAST('Selesai' AS status_produksi),
                        biaya_distribusi = @biaya
                    WHERE id = @id
                    """,
                    conn,
                    tx))
                {
                    cmdUpdate.Parameters.AddWithValue("id", distribusiId);
                    cmdUpdate.Parameters.AddWithValue("biaya", body.BiayaDistribusi);
                    await cmdUpdate.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();

                return Results.Ok(new
                {
                    id = distribusiId.ToString(),
                    message = "Distribusi berhasil ditandai selesai dan biaya distribusi telah dicatat."
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

    /// <summary>
    /// Shipped-portion counter: production output minus portions already
    /// assigned to distributions for that session.
    /// </summary>
    internal static async Task<decimal> GetRemainingPorsiAsync(
        NpgsqlDataSource dataSource, Guid sesiProduksiId, string? excludeDistribusiId)
    {
        await using var conn = await dataSource.OpenConnectionAsync();
        var sql =
            """
            SELECT sp.jumlah_porsi_diproduksi - COALESCE(SUM(d.jumlah_porsi), 0)
            FROM sesi_produksi sp
            LEFT JOIN distribusi d ON d.sesi_produksi_id = sp.id AND (@exclude::text IS NULL OR d.id::text <> @exclude)
            WHERE sp.id = @sesi
            GROUP BY sp.jumlah_porsi_diproduksi
            """;
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("sesi", sesiProduksiId);
        cmd.Parameters.AddWithValue("exclude", (object?)excludeDistribusiId ?? DBNull.Value);
        var scalar = await cmd.ExecuteScalarAsync();
        return scalar is null or DBNull ? 0 : Convert.ToDecimal(scalar, CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Enforced by the CRUD create/update endpoints when entity == distribusi:
    /// a distribution cannot ship more portions than the session has produced
    /// and not yet shipped. Returns an error message, or null when valid.
    /// </summary>
    internal static async Task<string?> ValidatePorsiAgainstProductionAsync(
        NpgsqlDataSource dataSource, JsonElement body, string? currentDistribusiId = null)
    {
        if (body.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        JsonElement? sesiProp = null;
        JsonElement? porsiProp = null;
        foreach (var prop in body.EnumerateObject())
        {
            if (string.Equals(prop.Name, "sesi_produksi_id", StringComparison.OrdinalIgnoreCase) && prop.Value.ValueKind != JsonValueKind.Null)
            {
                sesiProp = prop.Value;
            }
            else if (string.Equals(prop.Name, "jumlah_porsi", StringComparison.OrdinalIgnoreCase))
            {
                porsiProp = prop.Value;
            }
        }

        Guid sesiId;
        if (sesiProp.HasValue)
        {
            var rawSesi = sesiProp.Value.ValueKind == JsonValueKind.String
                ? sesiProp.Value.GetString()
                : sesiProp.Value.ToString();
            if (!Guid.TryParse(rawSesi, out sesiId))
            {
                return "Sesi produksi tidak valid.";
            }
        }
        else if (currentDistribusiId is not null && Guid.TryParse(currentDistribusiId, out var selfId))
        {
            // Update without changing the session: cap against that session.
            await using var conn0 = await dataSource.OpenConnectionAsync();
            await using (var cmd0 = new NpgsqlCommand(
                "SELECT sesi_produksi_id FROM distribusi WHERE id = @self", conn0))
            {
                cmd0.Parameters.AddWithValue("self", selfId);
                var existing = await cmd0.ExecuteScalarAsync();
                if (existing is null or DBNull)
                {
                    return null;
                }
                sesiId = (Guid)existing;
            }
        }
        else
        {
            return null;
        }

        await using var conn = await dataSource.OpenConnectionAsync();
        await using (var cmd = new NpgsqlCommand(
            "SELECT status::text FROM sesi_produksi WHERE id = @sesi", conn))
        {
            cmd.Parameters.AddWithValue("sesi", sesiId);
            var status = await cmd.ExecuteScalarAsync();
            if (status is null or DBNull)
            {
                return "Sesi produksi tidak ditemukan.";
            }
            if (string.Equals(Convert.ToString(status), "Dibatalkan", StringComparison.OrdinalIgnoreCase))
            {
                return "Produksi sesi ini telah dibatalkan — tidak bisa didistribusikan.";
            }
        }

        var remaining = await GetRemainingPorsiAsync(dataSource, sesiId, currentDistribusiId);

        decimal? jumlah;
        if (porsiProp.HasValue)
        {
            var v = porsiProp.Value;
            if (v.ValueKind == JsonValueKind.Number)
            {
                jumlah = v.GetDecimal();
            }
            else if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
            {
                jumlah = parsed;
            }
            else
            {
                jumlah = null;
            }
        }
        else
        {
            // No porsi in payload: on update the count is unchanged, on create
            // the required-column check reports the missing field.
            return null;
        }

        if (jumlah.Value < 0)
        {
            return "Jumlah porsi distribusi tidak boleh negatif.";
        }

        if (jumlah.Value > remaining)
        {
            return $"Jumlah porsi distribusi ({jumlah}) melebihi sisa produksi ({remaining} porsi tersisa).";
        }

        return null;
    }
}

public sealed record DistribusiCompleteRequest(decimal BiayaDistribusi);
