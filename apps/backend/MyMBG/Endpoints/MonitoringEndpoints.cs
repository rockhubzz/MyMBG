using Microsoft.AspNetCore.Http;
using MyMBG.Data;
using Npgsql;

namespace MyMBG.Endpoints;

public static class MonitoringEndpoints
{
    public static RouteGroupBuilder MapMonitoringEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/monitoring");

        /// <summary>
        /// Unified feed of production and distribution sessions.
        /// state=running   -> Direncanakan/Berlangsung
        /// state=completed -> Selesai
        /// state=all       -> everything (including Dibatalkan)
        /// </summary>
        group.MapGet("/", async (NpgsqlDataSource dataSource, HttpRequest request, TokenValidator tokenValidator, string? state) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var filter = (state ?? "running").Trim().ToLowerInvariant();
            if (filter is not ("running" or "completed" or "all"))
            {
                return Results.BadRequest(new { message = "state harus salah satu: running, completed, all." });
            }

            var statusFilter = filter switch
            {
                "running"   => "WHERE status IN ('Direncanakan', 'Berlangsung')",
                "completed" => "WHERE status = 'Selesai'",
                _           => ""
            };

            await using var conn = await dataSource.OpenConnectionAsync();
            var sql =
                $"""
                SELECT * FROM (
                    SELECT
                        'produksi'                           AS type,
                        sp.id                                AS id,
                        sp.kode_produksi                     AS kode,
                        r.nama_menu                          AS nama,
                        NULL::varchar                        AS lokasi,
                        sp.status::text                      AS status,
                        COALESCE(sp.tanggal_produksi, sp.created_at)::text AS waktu,
                        sp.jumlah_porsi_diproduksi           AS porsi,
                        sp.catatan                           AS catatan,
                        sp.created_at                        AS created_at,
                        (SELECT COALESCE(SUM(d.jumlah_porsi), 0)
                         FROM distribusi d
                         WHERE d.sesi_produksi_id = sp.id)   AS terkirim,
                        0::numeric                           AS biaya
                    FROM sesi_produksi sp
                    LEFT JOIN resep r ON r.id = sp.resep_id
                    UNION ALL
                    SELECT
                        'distribusi'                         AS type,
                        d.id,
                        d.kode_distribusi,
                        d.nama_penerima,
                        d.lokasi,
                        d.status::text,
                        COALESCE(d.waktu_distribusi::text, d.created_at::text),
                        d.jumlah_porsi,
                        d.catatan,
                        d.created_at,
                        0::numeric,
                        d.biaya_distribusi
                    FROM distribusi d
                    LEFT JOIN sesi_produksi sp ON sp.id = d.sesi_produksi_id
                ) all_sessions
                {statusFilter}
                ORDER BY waktu DESC, created_at DESC
                """;
            await using var cmd = new NpgsqlCommand(sql, conn);
            var rows = new List<object>();
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add(new
                {
                    type = reader.GetString(0),
                    id = reader.GetGuid(1).ToString(),
                    kode = reader.IsDBNull(2) ? null : reader.GetString(2),
                    nama = reader.IsDBNull(3) ? null : reader.GetString(3),
                    lokasi = reader.IsDBNull(4) ? null : reader.GetString(4),
                    status = reader.IsDBNull(5) ? null : reader.GetString(5),
                    waktu = reader.IsDBNull(6) ? null : reader.GetString(6),
                    porsi = reader.IsDBNull(7) ? 0 : reader.GetDecimal(7),
                    catatan = reader.IsDBNull(8) ? null : reader.GetString(8),
                    created_at = reader.IsDBNull(9) ? (DateTime?)null : reader.GetFieldValue<DateTime>(9),
                    terkirim = reader.IsDBNull(10) ? 0 : reader.GetDecimal(10),
                    biaya = reader.IsDBNull(11) ? 0 : reader.GetDecimal(11),
                });
            }
            return Results.Ok(rows);
        });

        return group;
    }
}
