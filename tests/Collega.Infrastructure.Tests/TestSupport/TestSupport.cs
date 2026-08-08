using Collega.Application.Abstractions;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Tests.TestSupport;

/// <summary>Fixed, mutable clock so seeding/repository tests stay hermetic.</summary>
internal sealed class TestClock : IClock
{
    public static readonly DateTime Default = new(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);

    public TestClock(DateTime? utcNow = null) => UtcNow = utcNow ?? Default;

    public DateTime UtcNow { get; set; }
}

/// <summary>Deterministic hasher (no random salt) so seeding tests are hermetic.</summary>
internal sealed class FakePasswordHasher : IPasswordHasher
{
    public const string Prefix = "hashed::";

    public string Hash(string password) => Prefix + password;

    public bool Verify(string password, string passwordHash) => passwordHash == Prefix + password;
}

/// <summary>Creates <see cref="CollegaDbContext"/> instances bound to the EF Core InMemory provider.</summary>
internal static class InMemoryContext
{
    /// <summary>A fresh, isolated context on its own database.</summary>
    public static CollegaDbContext Create() => Create(Guid.NewGuid().ToString());

    /// <summary>A context bound to a named database, so a second context can observe committed data.</summary>
    public static CollegaDbContext Create(string databaseName)
    {
        var options = new DbContextOptionsBuilder<CollegaDbContext>()
            .UseInMemoryDatabase(databaseName)
            .EnableSensitiveDataLogging()
            .Options;

        return new CollegaDbContext(options);
    }
}
