using Collega.Domain.Organizations;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// Owns the one <c>postgres:16</c> container shared by <see cref="PostgresProviderTests"/>. This has
/// to be a class fixture rather than <see cref="IAsyncLifetime"/> on the test class itself: xUnit
/// builds a fresh test-class instance per test method, so per-class lifetime on the test class would
/// start and tear down a container for every test.
/// </summary>
public sealed class PostgresContainerFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _postgres;

    /// <summary>Connection string for the container's default database. Credentials come from
    /// Testcontainers, so these tests are independent of whatever user the app is configured with.</summary>
    /// <exception cref="InvalidOperationException">
    /// The container was never started. The skip decision and this fixture probe Docker separately —
    /// discovery-time for <see cref="DockerRequiredFactAttribute"/>, execution-time here — so they
    /// can in principle disagree (the daemon dies in between, or discovery and execution run in
    /// different processes). This turns that into a legible message rather than a null dereference.
    /// </exception>
    public string ConnectionString =>
        _postgres?.GetConnectionString()
        ?? throw new InvalidOperationException(
            "The PostgreSQL container was not started: Docker looked available at discovery time but not when the fixture initialized.");

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        _postgres = new PostgreSqlBuilder("postgres:16").Build();
        await _postgres.StartAsync();
    }

    public async Task DisposeAsync()
    {
        if (_postgres is not null)
        {
            await _postgres.DisposeAsync();
        }
    }
}

/// <summary>
/// Verification that the Sprint 5 provider swap actually works against PostgreSQL. These run a real
/// <c>postgres:16</c> container and are, uniquely in this repo, deliberately <b>not hermetic</b>.
/// Every other EF test uses the InMemory provider, which models neither SQL translation, nor column
/// types, nor DDL, and so stayed green through the entire SQL Server to PostgreSQL swap while
/// proving nothing about it. The precedent for the shape of this — reach for the real component and
/// document why in the class itself — is <see cref="SkiaSharpImageProcessorTests"/>, though that one
/// is still hermetic; this class is the first that is not.
/// </summary>
/// <remarks>
/// One container serves the whole class (see <see cref="PostgresContainerFixture"/>) because
/// starting one is slow; each test creates its own database on it so the tests stay
/// order-independent. Tests skip rather than fail when no Docker daemon is reachable — see
/// <see cref="DockerRequiredFactAttribute"/>. The <c>Container</c> category trait exists so a CI
/// job that should not depend on Docker Hub can filter these out.
/// </remarks>
[Trait("Category", "Container")]
public sealed class PostgresProviderTests : IClassFixture<PostgresContainerFixture>
{
    private readonly PostgresContainerFixture _container;

    public PostgresProviderTests(PostgresContainerFixture container) => _container = container;

    [DockerRequiredFact]
    public async Task MigrateAsync_AppliesEveryMigrationToAFreshDatabase()
    {
        var connectionString = await CreateDatabaseAsync("migrate_up");
        await using var context = CreateContext(connectionString);

        await context.Database.MigrateAsync();

        var applied = (await context.Database.GetAppliedMigrationsAsync()).ToList();
        Assert.Equal(context.Database.GetMigrations(), applied);
        Assert.Contains(applied, migration => migration.EndsWith("_InitialCreate", StringComparison.Ordinal));
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
    }

    [DockerRequiredFact]
    public async Task TimestampColumns_RoundTripUtcDateTimes()
    {
        // Npgsql maps DateTime to `timestamp with time zone` and throws on write for any DateTime
        // whose Kind is not Utc, so the Kind — not the value — is what this guards. It is stated
        // explicitly here rather than inherited from Build/TestClock to keep that visible.
        var createdAtUtc = new DateTime(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);
        var connectionString = await CreateDatabaseAsync("timestamp_round_trip");

        await using (var seed = CreateContext(connectionString))
        {
            await seed.Database.MigrateAsync();
            seed.Organizations.Add(Organization.Create("Acme", "Acme description", "ACME-001", createdAtUtc));
            await seed.SaveChangesAsync();
        }

        await using var context = CreateContext(connectionString);
        var loaded = await context.Organizations.SingleAsync();

        Assert.Equal(createdAtUtc, loaded.CreatedAtUtc);
        Assert.Equal(createdAtUtc, loaded.UpdatedAtUtc);
        Assert.Equal(DateTimeKind.Utc, loaded.CreatedAtUtc.Kind);
        Assert.Equal(DateTimeKind.Utc, loaded.UpdatedAtUtc.Kind);
    }

    [DockerRequiredFact]
    public async Task NormalizedEmailIndex_IsEnforcedByTheDatabase()
    {
        var connectionString = await CreateDatabaseAsync("email_uniqueness");
        Guid organizationId;

        await using (var seed = CreateContext(connectionString))
        {
            await seed.Database.MigrateAsync();
            var organization = Build.Organization();
            seed.Organizations.Add(organization);
            seed.Users.Add(Build.User(organization.Id, email: "dup@example.com"));
            await seed.SaveChangesAsync();
            organizationId = organization.Id;
        }

        await using var context = CreateContext(connectionString);
        // Same address in a different case. The unique index is on the normalized column, so the
        // database has to reject this on its own, with no application-level check in the way.
        context.Users.Add(Build.User(organizationId, email: "DUP@Example.COM"));

        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());

        var postgres = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, postgres.SqlState);
        Assert.Equal("ux_users_normalized_email", postgres.ConstraintName);
    }

    /// <summary>Creates an empty database on the shared container and returns its connection string.</summary>
    private async Task<string> CreateDatabaseAsync(string databaseName)
    {
        var connectionStringBuilder = new NpgsqlConnectionStringBuilder(_container.ConnectionString);

        await using (var connection = new NpgsqlConnection(connectionStringBuilder.ConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            // Identifiers cannot be parameterized; databaseName is a literal supplied by these tests.
            command.CommandText = $"CREATE DATABASE \"{databaseName}\"";
            await command.ExecuteNonQueryAsync();
        }

        connectionStringBuilder.Database = databaseName;
        return connectionStringBuilder.ConnectionString;
    }

    private static CollegaDbContext CreateContext(string connectionString) =>
        new(new DbContextOptionsBuilder<CollegaDbContext>()
            .UseNpgsql(connectionString)
            .EnableSensitiveDataLogging()
            .Options);
}
