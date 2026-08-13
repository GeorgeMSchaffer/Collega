using Collega.Application.Boards;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Organizations;
using Collega.Domain.Statuses;

namespace Collega.Application.Tests;

public sealed class BoardServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeBoardRepository _boards = new();
    private readonly FakeStatusRepository _statuses = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();
    private readonly Organization _org;
    private readonly Status _s1;
    private readonly Status _s2;
    private readonly Status _s3;

    public BoardServiceTests()
    {
        _org = _orgs.Add(Build.Organization());
        _s1 = _statuses.Add(Build.Status(_org.Id, "New", sortOrder: 10));
        _s2 = _statuses.Add(Build.Status(_org.Id, "Doing", sortOrder: 20));
        _s3 = _statuses.Add(Build.Status(_org.Id, "Done", sortOrder: 30));
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.SiteAdmin;
    }

    private BoardService CreateSut() =>
        new(_boards, _statuses, _orgs, _uow, _audit, _currentUser, _clock);

    private static SwimlaneInput Lane(Status status, int order) => new(status.Id, order);

    // Create ------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_WithFewerThanTwoSwimlanes_ThrowsValidation()
    {
        var sut = CreateSut();
        var ex = await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0) })));
        Assert.True(ex.Errors.ContainsKey("swimlanes"));
    }

    [Fact]
    public async Task Create_WithDuplicateStatus_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0), Lane(_s1, 1) })));
    }

    [Fact]
    public async Task Create_WithStatusFromAnotherOrganization_ThrowsValidation()
    {
        var foreign = Build.Status(Guid.NewGuid(), "Foreign");
        _statuses.Add(foreign);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0), new SwimlaneInput(foreign.Id, 1) })));
    }

    [Fact]
    public async Task Create_WithDeletedStatus_ThrowsValidation()
    {
        _s3.SoftDelete(_clock.UtcNow, null);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0), Lane(_s3, 1) })));
    }

    [Fact]
    public async Task Create_Success_OrdersSwimlanesAndAudits()
    {
        var sut = CreateSut();

        var result = await sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s2, 1), Lane(_s1, 0) }));

        Assert.Equal(2, result.Swimlanes.Count);
        Assert.Equal(_s1.Id, result.Swimlanes[0].StatusId); // order 0 first
        Assert.Equal(_s2.Id, result.Swimlanes[1].StatusId);
        Assert.Contains(_audit.Events, e => e.EventType == "BoardCreated");
    }

    [Fact]
    public async Task Create_AsPlainUser_ThrowsForbidden()
    {
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = _org.Id;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0), Lane(_s2, 1) })));
    }

    // Read scope --------------------------------------------------------------------------------

    [Fact]
    public async Task List_AsMemberOfOtherOrganization_ThrowsNotFound()
    {
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = Guid.NewGuid();
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.ListAsync(_org.Id));
    }

    [Fact]
    public async Task GetById_ResolvesSwimlaneStatusNamesAndColors()
    {
        var board = _boards.Add(Build.Board(_org.Id, new[] { _s1.Id, _s2.Id }));
        var sut = CreateSut();

        var detail = await sut.GetByIdAsync(board.Id);

        Assert.Equal(2, detail.Swimlanes.Count);
        Assert.Equal("New", detail.Swimlanes[0].StatusName);
    }

    // Update / reorder --------------------------------------------------------------------------

    [Fact]
    public async Task Update_CanAddAndRemoveSwimlanes()
    {
        var board = _boards.Add(Build.Board(_org.Id, new[] { _s1.Id, _s2.Id }));
        var sut = CreateSut();

        var detail = await sut.UpdateAsync(board.Id, new UpdateBoardCommand("Renamed", false, new[] { Lane(_s2, 0), Lane(_s3, 1) }));

        Assert.Equal("Renamed", detail.Name);
        Assert.Equal(new[] { _s2.Id, _s3.Id }, detail.Swimlanes.Select(s => s.StatusId));
    }

    [Fact]
    public async Task Reorder_WithDifferentStatusSet_ThrowsValidation()
    {
        var board = _boards.Add(Build.Board(_org.Id, new[] { _s1.Id, _s2.Id }));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.ReorderSwimlanesAsync(board.Id, new ReorderSwimlanesCommand(new[] { Lane(_s1, 0), Lane(_s3, 1) })));
    }

    [Fact]
    public async Task Reorder_WithSameSet_UpdatesOrder()
    {
        var board = _boards.Add(Build.Board(_org.Id, new[] { _s1.Id, _s2.Id }));
        var sut = CreateSut();

        await sut.ReorderSwimlanesAsync(board.Id, new ReorderSwimlanesCommand(new[] { Lane(_s2, 0), Lane(_s1, 1) }));

        var reordered = board.Swimlanes.OrderBy(sl => sl.DisplayOrder).Select(sl => sl.StatusId).ToArray();
        Assert.Equal(new[] { _s2.Id, _s1.Id }, reordered);
        Assert.Contains(_audit.Events, e => e.EventType == "BoardSwimlanesReordered");
    }

    [Fact]
    public async Task Reorder_UnknownBoard_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.ReorderSwimlanesAsync(Guid.NewGuid(), new ReorderSwimlanesCommand(new[] { Lane(_s1, 0), Lane(_s2, 1) })));
    }

    [Fact]
    public async Task MutationsMadeWhileActingAsSomeone_CarryDualAttribution()
    {
        // Rule 14, and the gap the cloud review found: the column, the context property and the
        // AuditEvent parameter all existed, but only ViewAsService used them. Every other service
        // recorded _currentUser.UserId — which IS the target while impersonating — so a board created
        // through View As read as though the target had made it, with the real admin nowhere in the
        // record. View As is the Site Admin's only path to org content, so this was the primary
        // administrative path silently mis-attributing every write.
        var target = Guid.NewGuid();
        var realAdmin = Guid.NewGuid();

        _currentUser.UserId = target;              // acting identity, exactly as the resolver sets it
        _currentUser.OrganizationId = _org.Id;
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.ImpersonatingRealUserId = realAdmin;

        var sut = CreateSut();
        await sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0), Lane(_s2, 1) }));

        var audit = Assert.Single(_audit.Events.Where(e => e.EventType == "BoardCreated"));
        Assert.Equal(realAdmin, audit.ActorUserId);
        Assert.Equal(target, audit.OnBehalfOfUserId);
    }

    [Fact]
    public async Task MutationsMadeNormally_CarryNoOnBehalfOf()
    {
        // The other half: attribution must not be rewritten when nobody is impersonating.
        var sut = CreateSut();
        await sut.CreateAsync(_org.Id, new CreateBoardCommand("Board", true, new[] { Lane(_s1, 0), Lane(_s2, 1) }));

        var audit = Assert.Single(_audit.Events.Where(e => e.EventType == "BoardCreated"));
        Assert.Equal(_currentUser.UserId, audit.ActorUserId);
        Assert.Null(audit.OnBehalfOfUserId);
    }
}
