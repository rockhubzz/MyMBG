using MyMBG.Data;
using MyMBG.Endpoints;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL;

var builder = WebApplication.CreateBuilder(args);

// Listen on all network interfaces
builder.WebHost.UseUrls(
    "http://0.0.0.0:5292"
);

builder.Services.AddOpenApi();

var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");

if (string.IsNullOrWhiteSpace(connectionString))
{
    var postgresHost = Environment.GetEnvironmentVariable("POSTGRES_HOST");
    var postgresPort = Environment.GetEnvironmentVariable("POSTGRES_PORT");
    var postgresDatabase = Environment.GetEnvironmentVariable("POSTGRES_DB");
    var postgresUser = Environment.GetEnvironmentVariable("POSTGRES_USER");
    var postgresPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD")
        ?? ReadSecretFile(Environment.GetEnvironmentVariable("POSTGRES_PASSWORD_FILE"));

    if (
        !string.IsNullOrWhiteSpace(postgresHost)
        && !string.IsNullOrWhiteSpace(postgresDatabase)
        && !string.IsNullOrWhiteSpace(postgresUser)
        && !string.IsNullOrWhiteSpace(postgresPassword)
    )
    {
        var connectionBuilder = new NpgsqlConnectionStringBuilder
        {
            Host = postgresHost,
            Port = int.TryParse(postgresPort, out var parsedPort) ? parsedPort : 5432,
            Database = postgresDatabase,
            Username = postgresUser,
            Password = postgresPassword,
        };

        connectionString = connectionBuilder.ConnectionString;
    }
}

connectionString ??= builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Missing POSTGRES_CONNECTION_STRING or PostgreSQL connection settings."
    );
}

builder.Services.AddSingleton(
    _ => new NpgsqlDataSourceBuilder(connectionString).Build()
);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString)
);

builder.Services.AddSingleton<EntityMetadataProvider>();
builder.Services.AddScoped<GenericCrudRepository>();
builder.Services.AddScoped<TokenValidator>();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString)
);

builder.Services.AddCors(options =>
{
    options.AddPolicy("WebApp", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });

    options.AddPolicy("AllowVercel",
        policy =>
        {
            policy
                .WithOrigins(
                    "https://my-mbg.vercel.app/"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("WebApp");

await DatabaseBootstrapper.EnsureUsersTableAsync(app.Services);
await DatabaseBootstrapper.SeedDemoUsersAsync(app.Services);

// Ensure tokens table exists
var tokenValidator = app.Services.CreateScope().ServiceProvider.GetRequiredService<TokenValidator>();
await tokenValidator.EnsureTokensTableAsync();

app.MapGet("/db/ping", async (NpgsqlDataSource dataSource) =>
{
    await using var connection = await dataSource.OpenConnectionAsync();

    await using var command =
        new NpgsqlCommand("SELECT current_database()", connection);

    var databaseName = await command.ExecuteScalarAsync();

    return Results.Ok(new
    {
        connected = true,
        database = databaseName?.ToString()
    });
});

app.MapAuthEndpoints();
app.MapCrudEndpoints();
app.MapProduksiEndpoints();
app.MapDistribusiEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); // use your actual DbContext name
    db.Database.Migrate();
}

app.Run();

static string? ReadSecretFile(string? path)
{
    if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
    {
        return null;
    }

    return File.ReadAllText(path).Trim();
}
