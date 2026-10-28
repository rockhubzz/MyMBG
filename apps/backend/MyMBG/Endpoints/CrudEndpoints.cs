using System.Text.Json;
using Microsoft.AspNetCore.Http;
using MyMBG.Data;
using MyMBG.Models;
using Npgsql;

namespace MyMBG.Endpoints;

public static class CrudEndpoints
{
    /// <summary>
    /// Translate Postgres rejections (not-null, FK, duplicate, bad UUID ...)
    /// into a 400 with a readable message instead of an opaque 500.
    /// </summary>
    private static string FriendlyDatabaseError(PostgresException ex) => ex.SqlState switch
    {
        "23502" => $"Kolom '{ex.ColumnName ?? "database"}' wajib diisi.",
        "23503" => "Referensi/relasi tidak valid — pastikan data terkait sudah ada.",
        "23505" => "Data dengan nilai unik tersebut sudah ada.",
        "22P02" => "Format salah — periksa nilai UUID/angka/kategori.",
        _ => $"Database menolak data ({ex.SqlState})."
    };

    public static RouteGroupBuilder MapCrudEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/crud");

        group.MapGet("/meta/entities", async (GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var entities = await repo.GetEntitiesAsync();
            var output = entities.Values.Select(e => new
            {
                logicalName = e.LogicalName,
                tableName = e.TableName,
                primaryKey = e.PrimaryKey,
                columns = e.Columns
            });
            return Results.Ok(output);
        });

        group.MapGet("/meta/{entity}", async (string entity, GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var metadata = await repo.GetEntityAsync(entity);
            return metadata is null ? Results.NotFound(new { message = "Entity tidak ditemukan." }) : Results.Ok(metadata);
        });

        group.MapGet("/{entity}", async (string entity, int? page, int? pageSize, string? q, GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var result = await repo.ListAsync(entity, new ListQuery(page ?? 1, pageSize ?? 20, q));
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
        });

        group.MapGet("/{entity}/{id}", async (string entity, string id, GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var item = await repo.GetByIdAsync(entity, id);
                return item is null ? Results.NotFound(new { message = "Data tidak ditemukan." }) : Results.Ok(item);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        });

        group.MapPost("/{entity}", async (string entity, JsonElement body, GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var item = await repo.CreateAsync(entity, body);
                return Results.Ok(item);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
            catch (PostgresException ex)
            {
                return Results.BadRequest(new { message = FriendlyDatabaseError(ex) });
            }
            catch (Exception ex)
            {
                return Results.Json(
                    new { message = ex.Message },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        group.MapPut("/{entity}/{id}", async (string entity, string id, JsonElement body, GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var updated = await repo.UpdateAsync(entity, id, body);
                return updated is null ? Results.NotFound(new { message = "Data tidak ditemukan." }) : Results.Ok(updated);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
            catch (PostgresException ex)
            {
                return Results.BadRequest(new { message = FriendlyDatabaseError(ex) });
            }
            catch (Exception ex)
            {
                return Results.Json(
                    new { message = ex.Message },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        group.MapDelete("/{entity}/{id}", async (string entity, string id, GenericCrudRepository repo, HttpRequest request, TokenValidator tokenValidator) =>
        {
            var userId = await tokenValidator.ValidateTokenAsync(request);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var deleted = await repo.DeleteAsync(entity, id);
                return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { message = "Data tidak ditemukan." });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        });

        return group;
    }
}
