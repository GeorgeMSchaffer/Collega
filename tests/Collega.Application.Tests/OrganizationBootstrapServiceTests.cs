using Collega.Application.Organizations;
using Collega.Application.Tests.TestDoubles;

namespace Collega.Application.Tests;

public sealed class OrganizationBootstrapServiceTests
{
    private readonly FakeStatusRepository _statuses = new();
    private readonly FakeBoardRepository _boards = new();

    private OrganizationBootstrapService CreateSut() => new(_statuses, _boards);

    [Fact]
    public async Task Provision_CreatesCanonicalDefaultStatusesInOrder()
    {
        var orgId = Guid.NewGuid();
        var sut = CreateSut();

        var result = await sut.ProvisionDefaultsAsync(orgId, TestClock.Default, actorUserId: null);

        Assert.Equal(OrganizationDefaults.Statuses.Count, result.DefaultStatusCount);
        var names = _statuses.Statuses.OrderBy(s => s.SortOrder).Select(s => s.Name).ToArray();
        Assert.Equal(OrganizationDefaults.Statuses.Select(s => s.Name).ToArray(), names);
        Assert.All(_statuses.Statuses, s => Assert.Equal(orgId, s.OrganizationId));
    }

    [Fact]
    public async Task Provision_CreatesOneDefaultBoardWithEveryStatusAsSwimlane()
    {
        var orgId = Guid.NewGuid();
        var sut = CreateSut();

        var result = await sut.ProvisionDefaultsAsync(orgId, TestClock.Default, actorUserId: null);

        var board = Assert.Single(_boards.Boards);
        Assert.Equal(result.DefaultBoardId, board.Id);
        Assert.Equal(OrganizationDefaults.DefaultBoardName, board.Name);
        Assert.Equal(OrganizationDefaults.Statuses.Count, board.Swimlanes.Count);

        // Swimlanes follow catalog order and reference the provisioned statuses.
        var statusIdsInOrder = _statuses.Statuses.OrderBy(s => s.SortOrder).Select(s => s.Id).ToArray();
        var swimlaneIdsInOrder = board.Swimlanes.OrderBy(sl => sl.DisplayOrder).Select(sl => sl.StatusId).ToArray();
        Assert.Equal(statusIdsInOrder, swimlaneIdsInOrder);
    }
}
