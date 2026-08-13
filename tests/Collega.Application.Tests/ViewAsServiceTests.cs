using Collega.Application.Exceptions;
using Collega.Application.Impersonation;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Impersonation;
using Collega.Domain.Organizations;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

/// <summary>
/// The who-may-act-as-whom matrix from SPEC/20-feature-view-as.md rule 8, plus the invariants that
/// make impersonation safe: non-nestability, expiry, and dual-attribution audit.
/// </summary>
/// <remarks>
/// These exercise the real <see cref="ViewAsService"/> against in-memory fakes. What they prove is
/// the <b>decision logic</b> — which callers are refused and why. They do not prove that the
/// database enforces one open session per admin; that is the filtered unique index
/// <c>ux_impersonation_sessions_real_user_id_open</c>, which no in-memory test can exercise, for the
/// same reason the Sprint 5 post-mortem records: the InMemory provider models neither DDL nor
/// constraints.
/// </remarks>
public sealed class ViewAsServiceTests
{
    private readonly FakeUserRepository _users = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeImpersonationSessionRepository _sessions = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly FakeCurrentUserContext _currentUser = new();
    private readonly TestClock _clock = new();

    private ViewAsService Sut => new(_currentUser, _users, _orgs, _sessions, _audit, _uow, _clock);

    private Organization _acme = null!;
    private Organization _harbor = null!;

    private Organization Acme => _acme ??= AddOrg("Acme");
    private Organization Harbor => _harbor ??= AddOrg("Harbor");

    private Organization AddOrg(string title)
    {
        var org = Organization.Create(title, $"{title} description", $"{title.ToUpperInvariant()}-001", _clock.UtcNow);
        _orgs.Organizations.Add(org);
        return org;
    }

    private User AddUser(Organization org, Role role, UserStatus status = UserStatus.Active)
    {
        var user = Build.User(org.Id, role, status);
        _users.Users.Add(user);
        return user;
    }

    private User AddSiteAdmin()
    {
        // Unique email per call — Build.SiteAdmin defaults to one address, and these tests need two
        // distinct Site Admins to exercise D-SCOPE.
        var user = Build.SiteAdmin($"admin-{Guid.NewGuid():N}@collega.local");
        _users.Users.Add(user);
        return user;
    }

    /// <summary>Signs in as the real caller — no active session.</summary>
    private void ActingAs(User user)
    {
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = user.Id;
        _currentUser.OrganizationId = user.OrganizationId;
        _currentUser.Role = user.Role;
        _currentUser.ImpersonatingRealUserId = null;
    }

    // ---- The authorization matrix (rule 8) ----

    [Fact]
    public async Task SiteAdmin_MayActAsAnyOrgUser_InAnyOrganization()
    {
        var admin = AddSiteAdmin();
        var target = AddUser(Harbor, Role.User);
        ActingAs(admin);

        var result = await Sut.StartAsync(target.Id);

        Assert.Equal(target.Id, result.TargetUserId);
        Assert.Single(_sessions.Sessions);
    }

    [Fact]
    public async Task OrgAdmin_MayActAsUser_InOwnOrganization()
    {
        var orgAdmin = AddUser(Acme, Role.OrgAdmin);
        var target = AddUser(Acme, Role.User);
        ActingAs(orgAdmin);

        var result = await Sut.StartAsync(target.Id);

        Assert.Equal(target.Id, result.TargetUserId);
    }

    [Fact]
    public async Task OrgAdmin_MayNotReachAnotherOrganization()
    {
        var orgAdmin = AddUser(Acme, Role.OrgAdmin);
        var outsider = AddUser(Harbor, Role.User);
        ActingAs(orgAdmin);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(outsider.Id));
        Assert.Empty(_sessions.Sessions);
    }

    [Theory]
    [InlineData(Role.User)]
    [InlineData(Role.ReadOnly)]
    public async Task UnprivilegedRoles_MayNotActAsAnyone(Role role)
    {
        var caller = AddUser(Acme, role);
        var target = AddUser(Acme, Role.User);
        ActingAs(caller);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(target.Id));
    }

    /// <remarks>
    /// <b>This test cannot distinguish the D-SCOPE guard from its absence, and should not be read as
    /// proving it.</b> Verified by removing <c>target.Role == Role.SiteAdmin</c> from
    /// <c>EnsureMayActAs</c>: all 16 tests still passed. The reason is that the domain forbids a Site
    /// Admin from holding an <c>OrganizationId</c> (<c>User.cs:84</c> and <c>:225</c>), so the
    /// separate null-organization clause rejects them first. Making this discriminating would require
    /// constructing an org-scoped Site Admin, which the domain will not allow — so the behaviour is
    /// asserted here, and the guard's redundancy is documented at the guard itself.
    /// </remarks>
    [Fact]
    public async Task SiteAdmin_MayNotActAsAnotherSiteAdmin()
    {
        // D-SCOPE. A peer owns no organization content, so this would grant nothing — and it is a
        // lateral move between two equally privileged accounts, which is the shape of an audit
        // laundering path.
        var admin = AddSiteAdmin();
        var peer = AddSiteAdmin();
        ActingAs(admin);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(peer.Id));
    }

    [Fact]
    public async Task InactiveUser_IsNotAValidTarget()
    {
        // Rule 10 — the domain has Active/Inactive only; "suspended" in the comp means Inactive.
        var admin = AddSiteAdmin();
        var target = AddUser(Acme, Role.User, UserStatus.Inactive);
        ActingAs(admin);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(target.Id));
    }

    [Fact]
    public async Task NobodyMayActAsThemselves()
    {
        var orgAdmin = AddUser(Acme, Role.OrgAdmin);
        ActingAs(orgAdmin);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(orgAdmin.Id));
    }

    [Fact]
    public async Task RefusalsAreIndistinguishable_SoTheEndpointCannotBeUsedToProbe()
    {
        // A caller must not be able to tell "no such user" from "exists but forbidden", or learn a
        // target's role or organization by comparing messages.
        var orgAdmin = AddUser(Acme, Role.OrgAdmin);
        var outsider = AddUser(Harbor, Role.User);
        var siteAdmin = AddSiteAdmin();
        var inactive = AddUser(Acme, Role.User, UserStatus.Inactive);
        ActingAs(orgAdmin);

        var messages = new List<string>();
        foreach (var id in new[] { outsider.Id, siteAdmin.Id, inactive.Id })
        {
            var ex = await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(id));
            messages.Add(ex.Message);
        }

        Assert.Single(messages.Distinct());
    }

    [Fact]
    public async Task ArchivedOrganization_IsNotAValidTarget()
    {
        // Rule 12, and the gap the code review found: the picker greyed these out but the
        // authorization path did not check, so POSTing a target id directly succeeded. Archiving is
        // how an organization is decommissioned — it already invalidates the invite code and blocks
        // self-registration — so acting inside one has to be refused too.
        var admin = AddSiteAdmin();
        var target = AddUser(Harbor, Role.User);
        Harbor.Archive(_clock.UtcNow, admin.Id);
        ActingAs(admin);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => Sut.StartAsync(target.Id));
        Assert.Empty(_sessions.Sessions);
    }

    [Fact]
    public async Task ArchivedOrganizationCandidates_AreListedButNotSelectable()
    {
        var admin = AddSiteAdmin();
        var target = AddUser(Harbor, Role.User);
        Harbor.Archive(_clock.UtcNow, admin.Id);
        ActingAs(admin);

        var candidates = await Sut.ListCandidatesAsync(null);

        var entry = Assert.Single(candidates.Where(c => c.UserId == target.Id));
        Assert.False(entry.Selectable);
    }

    // ---- Invariants ----

    [Fact]
    public async Task SessionsAreNotNestable_SecondStartIsRefusedRatherThanReplacing()
    {
        var admin = AddSiteAdmin();
        var first = AddUser(Acme, Role.User);
        var second = AddUser(Harbor, Role.User);
        ActingAs(admin);

        await Sut.StartAsync(first.Id);
        await Assert.ThrowsAsync<ConflictAppException>(() => Sut.StartAsync(second.Id));

        // The original must survive — silently swapping targets is exactly the confusion the
        // non-nestable rule exists to prevent.
        Assert.Single(_sessions.Sessions);
        Assert.Equal(first.Id, _sessions.Sessions[0].TargetUserId);
    }

    [Fact]
    public async Task AnExpiredSessionDoesNotBlockANewOne()
    {
        var admin = AddSiteAdmin();
        var first = AddUser(Acme, Role.User);
        var second = AddUser(Acme, Role.User);
        ActingAs(admin);

        await Sut.StartAsync(first.Id);
        _clock.UtcNow = _clock.UtcNow.Add(ImpersonationSession.AbsoluteLifetime).AddMinutes(1);

        // Not a conflict: the old row is open but no longer live, so it must not wedge the admin out
        // of starting a new session.
        var result = await Sut.StartAsync(second.Id);
        Assert.Equal(second.Id, result.TargetUserId);

        // The stale row must be *closed*, not merely ignored. Two rows with a null ended_at_utc for
        // one administrator violate ux_impersonation_sessions_real_user_id_open, so leaving it open
        // would fail against a real database while passing here — the fake models no index.
        Assert.Single(_sessions.Sessions.Where(x => x.EndedAtUtc is null));
        Assert.Equal(ImpersonationEndReason.AbsoluteTimeout, _sessions.Sessions[0].EndReason);
    }

    [Fact]
    public async Task Exit_IsIdempotent_WhenNoSessionIsActive()
    {
        var admin = AddSiteAdmin();
        ActingAs(admin);

        await Sut.EndAsync();   // must not throw — contract says 204 either way

        Assert.Empty(_audit.Events.Where(e => e.EventType == "ViewAsEnded"));
    }

    [Fact]
    public async Task ExitingAnAlreadyExpiredSession_RecordsTheTimeout_NotAUserExit()
    {
        // end_reason is an accountability field. Recording ExitedByUser for a session that actually
        // timed out would put a claim in the record that is simply untrue.
        var admin = AddSiteAdmin();
        var target = AddUser(Acme, Role.User);
        ActingAs(admin);

        await Sut.StartAsync(target.Id);
        _clock.UtcNow = _clock.UtcNow.Add(ImpersonationSession.AbsoluteLifetime).AddMinutes(1);
        await Sut.EndAsync();

        Assert.Equal(ImpersonationEndReason.AbsoluteTimeout, _sessions.Sessions[0].EndReason);
    }

    // ---- Attribution (rules 13-14) ----

    [Fact]
    public async Task StartAndExit_AreAudited_WithTheRealAdminAsActor()
    {
        var admin = AddSiteAdmin();
        var target = AddUser(Acme, Role.User);
        ActingAs(admin);

        await Sut.StartAsync(target.Id);
        await Sut.EndAsync();

        foreach (var eventType in new[] { "ViewAsStarted", "ViewAsEnded" })
        {
            var entry = Assert.Single(_audit.Events.Where(e => e.EventType == eventType));

            // The whole point of rule 14: the trail names the administrator as the actor and the
            // target only as the subject. Reversing these would make the audit read as though the
            // target had done it to themselves.
            Assert.Equal(admin.Id, entry.ActorUserId);
            Assert.Equal(target.Id, entry.OnBehalfOfUserId);
        }
    }

    // ---- Candidate listing ----

    [Fact]
    public async Task OrgAdminCandidates_NeverIncludeAnotherOrganization()
    {
        var orgAdmin = AddUser(Acme, Role.OrgAdmin);
        AddUser(Acme, Role.User);
        AddUser(Harbor, Role.User);
        ActingAs(orgAdmin);

        var candidates = await Sut.ListCandidatesAsync(null);

        Assert.NotEmpty(candidates);
        Assert.All(candidates, c => Assert.Equal(Acme.Id, c.OrganizationId));
    }

    [Fact]
    public async Task Candidates_ExcludeSiteAdminsAndTheCallerThemselves()
    {
        var admin = AddSiteAdmin();
        AddSiteAdmin();
        var ordinary = AddUser(Acme, Role.User);
        ActingAs(admin);

        var candidates = await Sut.ListCandidatesAsync(null);

        Assert.Contains(candidates, c => c.UserId == ordinary.Id);
        Assert.DoesNotContain(candidates, c => c.Role == Role.SiteAdmin);
        Assert.DoesNotContain(candidates, c => c.UserId == admin.Id);
    }

    [Fact]
    public async Task InactiveCandidates_AreListedButNotSelectable()
    {
        // Rule 21: the comp greys them out rather than hiding them, so the list still returns them.
        var admin = AddSiteAdmin();
        var inactive = AddUser(Acme, Role.User, UserStatus.Inactive);
        ActingAs(admin);

        var candidates = await Sut.ListCandidatesAsync(null);

        var entry = Assert.Single(candidates.Where(c => c.UserId == inactive.Id));
        Assert.False(entry.Selectable);
    }
}
