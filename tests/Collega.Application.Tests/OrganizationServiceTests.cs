using Collega.Application.Exceptions;
using Collega.Application.Organizations;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;

namespace Collega.Application.Tests;

public sealed class OrganizationServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeStatusRepository _statuses = new();
    private readonly FakeBoardRepository _boards = new();
    private readonly FakeInviteCodeGenerator _inviteCodes = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser;

    public OrganizationServiceTests()
    {
        _currentUser = FakeCurrentUserContext.SiteAdmin();
    }

    private OrganizationService CreateSut()
    {
        var bootstrap = new OrganizationBootstrapService(_statuses, _boards);
        return new OrganizationService(_orgs, bootstrap, _inviteCodes, _uow, _audit, _currentUser, _clock);
    }

    private static OrganizationProfileFields EmptyProfile => new(null, null, null, null, null, null, null);

    private static CreateOrganizationCommand CreateCommand(string title = "Globex") =>
        new(title, "A description", null, EmptyProfile);

    // Authorization -----------------------------------------------------------------------------

    [Fact]
    public async Task List_AsNonSiteAdmin_ThrowsForbidden()
    {
        _currentUser.Role = Role.OrgAdmin;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.ListAsync(new OrganizationListQuery(null, null, null, false, null, null)));
    }

    [Fact]
    public async Task Create_AsOrgAdmin_ThrowsForbidden()
    {
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = Guid.NewGuid();
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.CreateAsync(CreateCommand()));
    }

    [Fact]
    public async Task Create_WhenUnauthenticated_ThrowsUnauthorized()
    {
        var anon = FakeCurrentUserContext.Anonymous();
        var sut = new OrganizationService(_orgs, new OrganizationBootstrapService(_statuses, _boards), _inviteCodes, _uow, _audit, anon, _clock);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.CreateAsync(CreateCommand()));
    }

    // Create ------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_AsSiteAdmin_ProvisionsDefaultStatusesAndBoard()
    {
        var sut = CreateSut();

        var result = await sut.CreateAsync(CreateCommand("Initech"));

        Assert.Single(_orgs.Organizations);
        Assert.Equal(OrganizationDefaults.Statuses.Count, result.DefaultStatusCount);
        Assert.Equal(OrganizationDefaults.Statuses.Count, _statuses.Statuses.Count);
        Assert.Single(_boards.Boards);
        Assert.Equal(_boards.Boards[0].Id, result.DefaultBoardId);
        Assert.False(string.IsNullOrWhiteSpace(result.InviteCode));
        Assert.Contains(_audit.Events, e => e.EventType == "OrganizationCreated");
    }

    [Fact]
    public async Task Create_GeneratesUniqueInviteCode_WhenFirstCandidateCollides()
    {
        // Pre-seed an org already using the first invite code the generator will produce.
        _orgs.Add(Build.Organization(inviteCode: "INVITE-001"));
        var sut = CreateSut();

        var result = await sut.CreateAsync(CreateCommand("Umbrella"));

        Assert.Equal("INVITE-002", result.InviteCode);
    }

    // Read scope --------------------------------------------------------------------------------

    [Fact]
    public async Task GetById_AsOrgAdminForOwnOrg_ReturnsDetail()
    {
        var org = _orgs.Add(Build.Organization());
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = org.Id;
        var sut = CreateSut();

        var detail = await sut.GetByIdAsync(org.Id);

        Assert.Equal(org.Id, detail.OrganizationId);
    }

    [Fact]
    public async Task GetById_AsOrgAdminForDifferentOrg_ThrowsNotFound()
    {
        var org = _orgs.Add(Build.Organization());
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = Guid.NewGuid();
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.GetByIdAsync(org.Id));
    }

    [Fact]
    public async Task GetById_AsPlainUser_ThrowsForbidden()
    {
        var org = _orgs.Add(Build.Organization());
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = org.Id;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.GetByIdAsync(org.Id));
    }

    // Update / regenerate / archive -------------------------------------------------------------

    [Fact]
    public async Task Update_AppliesNewValues_AndAudits()
    {
        var org = _orgs.Add(Build.Organization());
        var sut = CreateSut();

        var detail = await sut.UpdateAsync(org.Id, new UpdateOrganizationCommand("New Title", "New desc", "https://logo", EmptyProfile));

        Assert.Equal("New Title", detail.Title);
        Assert.Contains(_audit.Events, e => e.EventType == "OrganizationUpdated");
    }

    [Fact]
    public async Task RegenerateInviteCode_ReplacesWithUniqueCode_AndAudits()
    {
        var org = _orgs.Add(Build.Organization(inviteCode: "OLD"));
        var sut = CreateSut();

        var result = await sut.RegenerateInviteCodeAsync(org.Id);

        Assert.NotEqual("OLD", result.InviteCode);
        Assert.Equal(result.InviteCode, org.InviteCode);
        Assert.Contains(_audit.Events, e => e.EventType == "OrganizationInviteCodeRegenerated");
    }

    [Fact]
    public async Task Archive_AsOrgAdmin_ThrowsForbidden()
    {
        var org = _orgs.Add(Build.Organization());
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = org.Id;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.ArchiveAsync(org.Id));
    }

    [Fact]
    public async Task Archive_UnknownOrganization_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.ArchiveAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Archive_AsSiteAdmin_MarksArchived_AndAudits()
    {
        var org = _orgs.Add(Build.Organization());
        var sut = CreateSut();

        await sut.ArchiveAsync(org.Id);

        Assert.True(org.IsArchived);
        Assert.Contains(_audit.Events, e => e.EventType == "OrganizationArchived");
    }
}
