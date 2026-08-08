using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfOrganizationRepositoryTests
{
    [Fact]
    public async Task AddAndGetById_RoundTrips()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfOrganizationRepository(ctx);
        var org = Build.Organization();

        await repo.AddAsync(org);
        await ctx.SaveChangesAsync();

        var loaded = await repo.GetByIdAsync(org.Id);
        Assert.NotNull(loaded);
        Assert.Equal(org.Title, loaded!.Title);
    }

    [Fact]
    public async Task GetByInviteCode_AndInviteCodeExists()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfOrganizationRepository(ctx);
        await repo.AddAsync(Build.Organization(inviteCode: "JOIN-42"));
        await ctx.SaveChangesAsync();

        Assert.NotNull(await repo.GetByInviteCodeAsync("JOIN-42"));
        Assert.True(await repo.InviteCodeExistsAsync("JOIN-42"));
        Assert.False(await repo.InviteCodeExistsAsync("MISSING"));
    }

    [Fact]
    public async Task List_ExcludesArchivedByDefault_ButIncludesWhenRequested()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfOrganizationRepository(ctx);
        await repo.AddAsync(Build.Organization(title: "Active", inviteCode: "A-1"));
        await repo.AddAsync(Build.Organization(title: "Archived", inviteCode: "A-2", archived: true));
        await ctx.SaveChangesAsync();

        var defaultPage = await repo.ListAsync(new OrganizationListFilter(new PageRequest(1, 50), null, false, null, null), default);
        Assert.Single(defaultPage.Items);

        var withArchived = await repo.ListAsync(new OrganizationListFilter(new PageRequest(1, 50), null, true, null, null), default);
        Assert.Equal(2, withArchived.TotalCount);
    }

    [Fact]
    public async Task List_SearchMatchesTitleOrDescription()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfOrganizationRepository(ctx);
        await repo.AddAsync(Build.Organization(title: "Northwind", inviteCode: "N-1"));
        await repo.AddAsync(Build.Organization(title: "Contoso", inviteCode: "C-1"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListAsync(new OrganizationListFilter(new PageRequest(1, 50), "north", false, null, null), default);

        Assert.Single(page.Items);
        Assert.Equal("Northwind", page.Items[0].Title);
    }

    [Fact]
    public async Task List_SortsByTitleAndPages()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfOrganizationRepository(ctx);
        await repo.AddAsync(Build.Organization(title: "Zeta", inviteCode: "Z-1"));
        await repo.AddAsync(Build.Organization(title: "Alpha", inviteCode: "A-1"));
        await repo.AddAsync(Build.Organization(title: "Mid", inviteCode: "M-1"));
        await ctx.SaveChangesAsync();

        var asc = await repo.ListAsync(new OrganizationListFilter(new PageRequest(1, 2), null, false, null, "asc"), default);
        Assert.Equal(3, asc.TotalCount);
        Assert.Equal(2, asc.Items.Count);
        Assert.Equal("Alpha", asc.Items[0].Title);

        var desc = await repo.ListAsync(new OrganizationListFilter(new PageRequest(1, 1), null, false, "companyName", "desc"), default);
        Assert.Equal("Zeta", desc.Items[0].Title);
    }
}
