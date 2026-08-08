using Collega.Application.Abstractions;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;

namespace Collega.Application.Tests.TestDoubles;

/// <summary>Fixed, mutable clock so use-case tests stay hermetic (no <c>DateTime.Now</c>).</summary>
internal sealed class TestClock : IClock
{
    public static readonly DateTime Default = new(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);

    public TestClock(DateTime? utcNow = null) => UtcNow = utcNow ?? Default;

    public DateTime UtcNow { get; set; }
}

/// <summary>Settable <see cref="ICurrentUserContext"/> with factory helpers for each role.</summary>
internal sealed class FakeCurrentUserContext : ICurrentUserContext
{
    public bool IsAuthenticated { get; set; }
    public Guid? UserId { get; set; }
    public Guid? OrganizationId { get; set; }
    public Role? Role { get; set; }

    public static FakeCurrentUserContext Anonymous() => new();

    public static FakeCurrentUserContext SiteAdmin(Guid? userId = null) => new()
    {
        IsAuthenticated = true,
        UserId = userId ?? Guid.NewGuid(),
        OrganizationId = null,
        Role = Collega.Domain.Enums.Role.SiteAdmin
    };

    public static FakeCurrentUserContext OrgAdmin(Guid organizationId, Guid? userId = null) => new()
    {
        IsAuthenticated = true,
        UserId = userId ?? Guid.NewGuid(),
        OrganizationId = organizationId,
        Role = Collega.Domain.Enums.Role.OrgAdmin
    };

    public static FakeCurrentUserContext User(Guid organizationId, Guid? userId = null) => new()
    {
        IsAuthenticated = true,
        UserId = userId ?? Guid.NewGuid(),
        OrganizationId = organizationId,
        Role = Collega.Domain.Enums.Role.User
    };

    public static FakeCurrentUserContext ReadOnly(Guid organizationId, Guid? userId = null) => new()
    {
        IsAuthenticated = true,
        UserId = userId ?? Guid.NewGuid(),
        OrganizationId = organizationId,
        Role = Collega.Domain.Enums.Role.ReadOnly
    };
}

/// <summary>
/// Deterministic hasher: the "hash" is a fixed prefix plus the plaintext, so <see cref="Verify"/>
/// is a pure string comparison — hermetic and inspectable, no real cryptography.
/// </summary>
internal sealed class FakePasswordHasher : IPasswordHasher
{
    public const string Prefix = "hashed::";

    public string Hash(string password) => Prefix + password;

    public bool Verify(string password, string passwordHash) => passwordHash == Prefix + password;
}

/// <summary>Counts commits so a test can assert whether a use case persisted.</summary>
internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveChangesCount { get; private set; }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}

/// <summary>Records every emitted audit event for assertions.</summary>
internal sealed class RecordingAuditEventWriter : IAuditEventWriter
{
    public List<AuditEvent> Events { get; } = new();

    public Task WriteAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        Events.Add(auditEvent);
        return Task.CompletedTask;
    }
}

/// <summary>Deterministic invite-code generator returning a predictable, unique sequence.</summary>
internal sealed class FakeInviteCodeGenerator : IInviteCodeGenerator
{
    private int _counter;

    public string Generate() => $"INVITE-{++_counter:D3}";
}

/// <summary>Deterministic access-token issuer that records the last issuance.</summary>
internal sealed class FakeAccessTokenIssuer : IAccessTokenIssuer
{
    public Guid LastUserId { get; private set; }
    public string LastSecurityStamp { get; private set; } = string.Empty;

    public AccessTokenResult Issue(Guid userId, string securityStamp, DateTime nowUtc)
    {
        LastUserId = userId;
        LastSecurityStamp = securityStamp;
        return new AccessTokenResult($"token-{userId:N}", 3600);
    }
}
