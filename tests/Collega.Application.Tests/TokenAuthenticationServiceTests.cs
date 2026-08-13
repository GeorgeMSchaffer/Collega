using Collega.Application.Abstractions;
using Collega.Application.Auth;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Impersonation;
using Collega.Domain.Organizations;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

/// <summary>
/// Which identity a request ends up acting under. This is the most security-critical decision in
/// View As — everything downstream authorizes off the principal produced here — and it had no unit
/// coverage until the Sprint 6 code review pointed out that rule 12's archived-organization half was
/// never enforced.
/// </summary>
public sealed class TokenAuthenticationServiceTests
{
    private const string Token = "token";

    private readonly FakeUserRepository _users = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeImpersonationSessionRepository _sessions = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly TestClock _clock = new();
    private readonly StubTokenValidator _validator = new();

    private TokenAuthenticationService Sut => new(_validator, _users, _orgs, _sessions, _uow, _clock);

    private Organization AddOrg(bool archived = false)
    {
        var org = Organization.Create("Acme", "Acme description", "ACME-001", _clock.UtcNow);
        if (archived)
        {
            org.Archive(_clock.UtcNow, null);
        }

        _orgs.Organizations.Add(org);
        return org;
    }

    private User AddUser(Organization org, Role role = Role.User, UserStatus status = UserStatus.Active)
    {
        var user = Build.User(org.Id, role, status);
        _users.Users.Add(user);
        return user;
    }

    private User AddAdmin()
    {
        var admin = Build.SiteAdmin($"admin-{Guid.NewGuid():N}@collega.local");
        _users.Users.Add(admin);
        _validator.UserId = admin.Id;
        _validator.SecurityStamp = admin.SecurityStamp;
        return admin;
    }

    private ImpersonationSession StartSession(User admin, User target)
    {
        var session = ImpersonationSession.Start(admin.Id, target.Id, _clock.UtcNow);
        _sessions.Sessions.Add(session);
        return session;
    }

    [Fact]
    public async Task WithNoSession_ThePrincipalIsTheRealUser()
    {
        var admin = AddAdmin();

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.NotNull(principal);
        Assert.Equal(admin.Id, principal!.UserId);
        Assert.Null(principal.Impersonation);
    }

    [Fact]
    public async Task WithALiveSession_ThePrincipalIsTheTarget()
    {
        // The heart of rule 4: identity fields are the target's, so every downstream org-scoping and
        // role check applies to them without any service knowing impersonation exists.
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org, Role.OrgAdmin);
        StartSession(admin, target);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.NotNull(principal);
        Assert.Equal(target.Id, principal!.UserId);
        Assert.Equal(org.Id, principal.OrganizationId);
        Assert.Equal(Role.OrgAdmin, principal.Role);
        Assert.Equal(admin.Id, principal.Impersonation!.RealUserId);
    }

    [Fact]
    public async Task RealUsersOwnRotationGateApplies_NotTheTargets()
    {
        // An administrator must not inherit the target's rotation gate, and must not have their own
        // suppressed by acting as someone who has already rotated.
        var org = AddOrg();
        var admin = AddAdmin();          // seeded Site Admins carry MustChangePassword = true
        var target = AddUser(org);
        StartSession(admin, target);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.Equal(admin.MustChangePassword, principal!.MustChangePassword);
    }

    [Fact]
    public async Task WhenTheTargetsOrganizationIsArchived_TheSessionEnds()
    {
        // Rule 12's second half, and the gap the code review found. The target stays Active —
        // archiving decommissions the organization without touching its users — so a check on user
        // status alone lets the administrator keep acting inside it until expiry.
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org);
        var session = StartSession(admin, target);

        org.Archive(_clock.UtcNow, admin.Id);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.Equal(admin.Id, principal!.UserId);       // reverted to acting as themselves
        Assert.Null(principal.Impersonation);
        Assert.NotNull(session.EndedAtUtc);
        Assert.Equal(ImpersonationEndReason.TargetNoLongerValid, session.EndReason);
    }

    [Fact]
    public async Task WhenTheTargetIsDeactivated_TheSessionEnds()
    {
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org);
        var session = StartSession(admin, target);

        target.Administer(target.FirstName, target.LastName, target.Email, target.Role, UserStatus.Inactive, _clock.UtcNow, admin.Id);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.Null(principal!.Impersonation);
        Assert.Equal(ImpersonationEndReason.TargetNoLongerValid, session.EndReason);
    }

    [Theory]
    [InlineData(true)]   // past the absolute cap
    [InlineData(false)]  // idle only
    public async Task AnExpiredSessionEndsWithTheReasonThatMatches(bool absolute)
    {
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org);
        var session = StartSession(admin, target);

        _clock.UtcNow = _clock.UtcNow.Add(
            absolute ? ImpersonationSession.AbsoluteLifetime : ImpersonationSession.IdleTimeout).AddMinutes(1);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.Null(principal!.Impersonation);
        Assert.Equal(
            absolute ? ImpersonationEndReason.AbsoluteTimeout : ImpersonationEndReason.IdleTimeout,
            session.EndReason);
    }

    [Fact]
    public async Task WhenTheRealAdminIsDemoted_TheSessionEnds()
    {
        // Nothing rotates the security stamp when User.Administer changes a role, so the demoted
        // admin's token stays valid. Without a per-request re-check they would keep operating with
        // the target's elevated identity until the 2-hour cap — revocation that does not revoke.
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org, Role.OrgAdmin);
        var session = StartSession(admin, target);

        admin.Administer(admin.FirstName, admin.LastName, admin.Email, Role.User, UserStatus.Active, _clock.UtcNow, admin.Id);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.Equal(admin.Id, principal!.UserId);
        Assert.Null(principal.Impersonation);
        Assert.Equal(ImpersonationEndReason.RealUserNoLongerAuthorized, session.EndReason);
    }

    [Fact]
    public async Task AnOrgAdminActingOutsideTheirOwnOrganization_HasTheSessionEnded()
    {
        // Rule 11 re-applied mid-session: an Org Admin may only ever act within their own
        // organization, so a session that no longer satisfies that must not survive.
        var theirOrg = AddOrg();
        var otherOrg = Organization.Create("Harbor", "Harbor description", "HARB-001", _clock.UtcNow);
        _orgs.Organizations.Add(otherOrg);

        var admin = Build.User(theirOrg.Id, Role.OrgAdmin);
        _users.Users.Add(admin);
        _validator.UserId = admin.Id;
        _validator.SecurityStamp = admin.SecurityStamp;

        var target = AddUser(otherOrg, Role.User);
        var session = StartSession(admin, target);

        var principal = await Sut.AuthenticateAsync(Token);

        Assert.Null(principal!.Impersonation);
        Assert.Equal(ImpersonationEndReason.RealUserNoLongerAuthorized, session.EndReason);
    }

    [Fact]
    public async Task LastSeenIsNotRewrittenOnEveryRequest()
    {
        // Regression for the review finding that Touch+SaveChanges ran per request, turning every
        // GET during a session into a database write. Expiry accuracy does not need that.
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org);
        var session = StartSession(admin, target);

        var original = session.LastSeenAtUtc;
        _clock.UtcNow = _clock.UtcNow.AddSeconds(30);

        await Sut.AuthenticateAsync(Token);

        Assert.Equal(original, session.LastSeenAtUtc);
    }

    [Fact]
    public async Task LastSeenIsRefreshedOnceItHasGoneStale()
    {
        // The other half: the idle window still has to advance, or a long session would expire while
        // actively in use.
        var org = AddOrg();
        var admin = AddAdmin();
        var target = AddUser(org);
        var session = StartSession(admin, target);

        _clock.UtcNow = _clock.UtcNow.AddMinutes(10);   // > a quarter of the 30-minute idle window

        await Sut.AuthenticateAsync(Token);

        Assert.Equal(_clock.UtcNow, session.LastSeenAtUtc);
    }

    private sealed class StubTokenValidator : IAccessTokenValidator
    {
        public Guid UserId { get; set; }
        public string SecurityStamp { get; set; } = string.Empty;

        public bool TryValidate(string token, DateTime nowUtc, out Guid userId, out string securityStamp)
        {
            userId = UserId;
            securityStamp = SecurityStamp;
            return true;
        }
    }
}
