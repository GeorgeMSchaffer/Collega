using Collega.Application.Exceptions;
using Collega.Application.Organizations;
using Collega.Application.Statuses;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Boards;
using Collega.Domain.Enums;
using Collega.Domain.Organizations;
using Collega.Domain.Statuses;

namespace Collega.Application.Tests;

public sealed class StatusServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeStatusRepository _statuses = new();
    private readonly FakeBoardRepository _boards = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();
    private readonly Organization _org;

    public StatusServiceTests()
    {
        _org = _orgs.Add(Build.Organization());
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.SiteAdmin;
    }

    private StatusService CreateSut() =>
        new(_statuses, _boards, _orgs, _uow, _audit, _currentUser, _clock);

    private Status SeedStatus(string name = "New", int sortOrder = 10)
    {
        var status = Build.Status(_org.Id, name, sortOrder: sortOrder);
        return _statuses.Add(status);
    }

    // List / read scope -------------------------------------------------------------------------

    [Fact]
    public async Task List_AsMemberOfOtherOrganization_ThrowsNotFound()
    {
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = Guid.NewGuid();
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.ListAsync(_org.Id, includeDeleted: false));
    }

    [Fact]
    public async Task List_AsMember_ReturnsActiveStatuses()
    {
        SeedStatus("New", 10);
        var deleted = SeedStatus("Old", 20);
        deleted.SoftDelete(_clock.UtcNow, null);
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = _org.Id;
        var sut = CreateSut();

        var items = await sut.ListAsync(_org.Id, includeDeleted: false);

        Assert.Single(items);
    }

    // Create ------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_AsPlainUser_ThrowsForbidden()
    {
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = _org.Id;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.CreateAsync(_org.Id, new CreateStatusCommand("Blocked", null, null)));
    }

    [Fact]
    public async Task Create_WithoutColor_UsesDefaultColor_AndAppendsSortOrder()
    {
        SeedStatus("New", 10);
        var sut = CreateSut();

        var result = await sut.CreateAsync(_org.Id, new CreateStatusCommand("Blocked", null, null));

        Assert.Equal(OrganizationDefaults.DefaultStatusColor, result.Color);
        Assert.Equal(20, result.SortOrder);
        Assert.Contains(_audit.Events, e => e.EventType == "StatusCreated");
    }

    // Update ------------------------------------------------------------------------------------

    [Fact]
    public async Task Update_UnknownStatus_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.UpdateAsync(Guid.NewGuid(), new UpdateStatusCommand("X", null, null)));
    }

    [Fact]
    public async Task Update_DeletedStatus_ThrowsNotFound()
    {
        var status = SeedStatus();
        status.SoftDelete(_clock.UtcNow, null);
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.UpdateAsync(status.Id, new UpdateStatusCommand("X", null, null)));
    }

    [Fact]
    public async Task Update_AppliesNameAndColor()
    {
        var status = SeedStatus();
        var sut = CreateSut();

        var item = await sut.UpdateAsync(status.Id, new UpdateStatusCommand("Renamed", "#111111", 99));

        Assert.Equal("Renamed", item.Name);
        Assert.Equal("#111111", item.Color);
        Assert.Equal(99, item.SortOrder);
    }

    // Delete ------------------------------------------------------------------------------------

    [Fact]
    public async Task Delete_WhenAtActiveFloor_ThrowsValidation()
    {
        SeedStatus("A", 10);
        var b = SeedStatus("B", 20); // exactly 2 active -> at the floor
        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<ValidationAppException>(() => sut.DeleteAsync(b.Id));
        Assert.True(ex.Errors.ContainsKey("status"));
        Assert.False(b.IsDeleted);
    }

    [Fact]
    public async Task Delete_WhenReferencedBySwimlane_ThrowsValidation()
    {
        var a = SeedStatus("A", 10);
        var b = SeedStatus("B", 20);
        SeedStatus("C", 30); // 3 active so floor is not the blocker
        _boards.Add(Build.Board(_org.Id, new[] { a.Id, b.Id }));
        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<ValidationAppException>(() => sut.DeleteAsync(a.Id));
        Assert.Contains("swimlane", string.Join(" ", ex.Errors["status"]), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Delete_Unreferenced_AboveFloor_SoftDeletes_AndAudits()
    {
        SeedStatus("A", 10);
        SeedStatus("B", 20);
        var c = SeedStatus("C", 30);
        var sut = CreateSut();

        await sut.DeleteAsync(c.Id);

        Assert.True(c.IsDeleted);
        Assert.Contains(_audit.Events, e => e.EventType == "StatusDeleted");
    }

    [Fact]
    public async Task Delete_AlreadyDeleted_IsIdempotent_NoAudit()
    {
        SeedStatus("A", 10);
        SeedStatus("B", 20);
        var c = SeedStatus("C", 30);
        c.SoftDelete(_clock.UtcNow, null);
        var sut = CreateSut();

        await sut.DeleteAsync(c.Id);

        Assert.DoesNotContain(_audit.Events, e => e.EventType == "StatusDeleted");
    }
}
