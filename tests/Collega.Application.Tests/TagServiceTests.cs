using Collega.Application.Exceptions;
using Collega.Application.Tags;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Tags;

namespace Collega.Application.Tests;

public sealed class TagServiceTests
{
    private readonly FakeTagRepository _tags = new();
    private readonly FakeCurrentUserContext _currentUser = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public TagServiceTests()
    {
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.OrganizationId = _orgId;
        _currentUser.Role = Role.User;
    }

    private TagService CreateSut() => new(_tags, _currentUser);

    private void SeedTag(string name, Guid? orgId = null) =>
        _tags.Add(Tag.Create(orgId ?? _orgId, name, TestClock.Default));

    [Fact]
    public async Task Suggest_WhenUnauthenticated_ThrowsUnauthorized()
    {
        var anon = FakeCurrentUserContext.Anonymous();
        var sut = new TagService(_tags, anon);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.SuggestAsync(_orgId, "ur", null));
    }

    [Fact]
    public async Task Suggest_ForDifferentOrganization_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.SuggestAsync(Guid.NewGuid(), "ur", null));
    }

    [Theory]
    [InlineData("")]
    [InlineData("a")]
    [InlineData(" a ")]
    public async Task Suggest_BelowMinimumLength_ReturnsEmpty(string search)
    {
        SeedTag("apple");
        var sut = CreateSut();

        var result = await sut.SuggestAsync(_orgId, search, null);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Suggest_MatchesPrefixCaseInsensitively_OrderedAlphabetically()
    {
        SeedTag("Urgent");
        SeedTag("urban");
        SeedTag("backlog");
        var sut = CreateSut();

        var result = await sut.SuggestAsync(_orgId, "UR", null);

        Assert.Equal(new[] { "urban", "Urgent" }, result);
    }

    [Fact]
    public async Task Suggest_ScopesToCallerOrganization()
    {
        SeedTag("urgent");
        SeedTag("urgent-other", Guid.NewGuid());
        var sut = CreateSut();

        var result = await sut.SuggestAsync(_orgId, "urg", null);

        Assert.Equal(new[] { "urgent" }, result);
    }

    [Fact]
    public async Task Suggest_ClampsLimitToAtLeastOne()
    {
        SeedTag("urban");
        SeedTag("urgent");
        var sut = CreateSut();

        var result = await sut.SuggestAsync(_orgId, "ur", 1);

        Assert.Single(result);
    }

    [Fact]
    public async Task Suggest_AsSiteAdmin_AllowedForAnyOrganization()
    {
        _currentUser.Role = Role.SiteAdmin;
        _currentUser.OrganizationId = null;
        SeedTag("urgent");
        var sut = CreateSut();

        var result = await sut.SuggestAsync(_orgId, "ur", null);

        Assert.Equal(new[] { "urgent" }, result);
    }
}
