using Collega.Application.Abstractions;
using Collega.Application.Ai;
using Collega.Domain.Ai;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.Notifications;

namespace Collega.Application.Tests.TestDoubles;

/// <summary>Fixed, mutable clock so use-case tests stay hermetic (no <c>DateTime.Now</c>).</summary>
internal sealed class TestClock : IClock
{
    public static readonly DateTime Default = new(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);

    public TestClock(DateTime? utcNow = null) => UtcNow = utcNow ?? Default;

    public DateTime UtcNow { get; set; }
}

/// <summary>
/// Deterministic <see cref="IImageProcessor"/>. Real decode/resize is exercised in
/// Collega.Infrastructure.Tests against ImageSharp; here we only need to steer the Application-layer
/// branch: any non-empty input is treated as a valid image (returns a fixed 3-byte "thumbnail")
/// unless <see cref="RejectAll"/> is set, which simulates content that failed the codec check.
/// </summary>
internal sealed class FakeImageProcessor : IImageProcessor
{
    public bool RejectAll { get; set; }

    public byte[] Thumbnail { get; set; } = { 1, 2, 3 };

    public byte[]? LastInput { get; private set; }

    public byte[]? TryCreatePngThumbnail(byte[] input, int maxDimension)
    {
        LastInput = input;
        if (RejectAll || input is null || input.Length == 0)
        {
            return null;
        }

        return Thumbnail;
    }
}

/// <summary>Settable <see cref="ICurrentUserContext"/> with factory helpers for each role.</summary>
internal sealed class FakeCurrentUserContext : ICurrentUserContext
{
    public bool IsAuthenticated { get; set; }
    public Guid? UserId { get; set; }
    public Guid? OrganizationId { get; set; }
    public Role? Role { get; set; }

    /// <summary>Set this to simulate an active View As session; leave null for an ordinary caller.</summary>
    public Guid? ImpersonatingRealUserId { get; set; }

    public bool IsImpersonating => ImpersonatingRealUserId is not null;

    /// <summary>Mirrors the production adapter: falls back to <see cref="UserId"/> when not impersonating.</summary>
    public Guid? RealUserId => ImpersonatingRealUserId ?? UserId;

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

/// <summary>Records every emitted notification event for assertions (spy; no suppression).</summary>
internal sealed class RecordingNotificationEventWriter : INotificationEventWriter
{
    public List<NotificationWrite> Writes { get; } = new();

    public Task WriteAsync(
        NotificationEventType eventType,
        Guid organizationId,
        Guid boardId,
        Guid ideaId,
        string ideaTitle,
        Guid actorUserId,
        Guid recipientUserId,
        CancellationToken cancellationToken = default)
    {
        Writes.Add(new NotificationWrite(
            eventType, organizationId, boardId, ideaId, ideaTitle, actorUserId, recipientUserId));
        return Task.CompletedTask;
    }
}

internal readonly record struct NotificationWrite(
    NotificationEventType EventType,
    Guid OrganizationId,
    Guid BoardId,
    Guid IdeaId,
    string IdeaTitle,
    Guid ActorUserId,
    Guid RecipientUserId);

/// <summary>
/// Scriptable <see cref="IIdeaDraftModel"/>. No test may reach a real provider, so the model's answer
/// is whatever the test says it is — which is also the only way to exercise the branches that matter:
/// a returned id that is not in the retrieved set, a refusal, a provider failure.
/// </summary>
internal sealed class FakeIdeaDraftModel : IIdeaDraftModel
{
    public bool IsConfigured { get; set; } = true;

    /// <summary>Set to make the next call throw, exercising the degradation path.</summary>
    public bool ThrowOnCall { get; set; }

    public IdeaDraftModelResponse Next { get; set; } =
        new(InScope: true, "What problem does this solve?", IdeaDraft.Empty, InputTokens: 900, OutputTokens: 120);

    public int CallCount { get; private set; }

    /// <summary>The context the service assembled — asserted on for org scoping and scope-statement flow.</summary>
    public IdeaAssistContext? LastContext { get; private set; }

    public IReadOnlyList<IdeaAssistTurn>? LastTranscript { get; private set; }

    public Task<IdeaDraftModelResponse> ContinueAsync(
        IdeaAssistContext context,
        IReadOnlyList<IdeaAssistTurn> transcript,
        IdeaDraft currentDraft,
        CancellationToken cancellationToken = default)
    {
        CallCount++;
        LastContext = context;
        LastTranscript = transcript;

        if (ThrowOnCall)
        {
            throw new IdeaDraftModelException("Simulated provider failure.");
        }

        return Task.FromResult(Next);
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

/// <summary>
/// Published prompt versions. Empty by default, which is the deployment's normal state and means the
/// built-in default is in force — so existing tests keep exercising the compiled prompt unchanged.
/// </summary>
internal sealed class FakeAiPromptVersionRepository : IAiPromptVersionRepository
{
    private readonly List<AiPromptVersion> _versions = new();

    public IReadOnlyList<AiPromptVersion> Versions => _versions;

    public Task<AiPromptVersion?> GetActiveAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(_versions.FirstOrDefault(v => v.IsActive));

    public Task<IReadOnlyList<AiPromptVersion>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<AiPromptVersion>>(_versions.OrderByDescending(v => v.Version).ToList());

    public Task<AiPromptVersion?> GetByVersionAsync(int version, CancellationToken cancellationToken = default) =>
        Task.FromResult(_versions.FirstOrDefault(v => v.Version == version));

    public Task<int> GetMaxVersionAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(_versions.Count == 0 ? 0 : _versions.Max(v => v.Version));

    public Task AddAsync(AiPromptVersion version, CancellationToken cancellationToken = default)
    {
        _versions.Add(version);
        return Task.CompletedTask;
    }

    public Task DeactivateAllAsync(CancellationToken cancellationToken = default)
    {
        foreach (var version in _versions.Where(v => v.IsActive))
        {
            version.Deactivate();
        }

        return Task.CompletedTask;
    }
}
