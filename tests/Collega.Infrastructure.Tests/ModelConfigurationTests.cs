using Collega.Domain.Tags;
using Collega.Domain.Upvotes;
using Collega.Domain.Users;
using Collega.Infrastructure.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// Verifies the EF configurations that back the spec's uniqueness invariants. The InMemory provider
/// does not enforce unique indexes at runtime, so these assert the configured model metadata that the
/// relational provider turns into the actual constraints.
/// </summary>
public sealed class ModelConfigurationTests
{
    [Fact]
    public void User_HasUniqueIndexOnNormalizedEmail()
    {
        using var ctx = InMemoryContext.Create();
        var index = ctx.Model.FindEntityType(typeof(User))!
            .GetIndexes()
            .Single(i => i.Properties.Count == 1 && i.Properties[0].Name == nameof(User.NormalizedEmail));

        Assert.True(index.IsUnique);
    }

    [Fact]
    public void Tag_HasCompositeUniqueIndexOnOrganizationAndNormalizedName()
    {
        using var ctx = InMemoryContext.Create();
        var index = ctx.Model.FindEntityType(typeof(Tag))!
            .GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name)
                .SequenceEqual(new[] { nameof(Tag.OrganizationId), nameof(Tag.NormalizedName) }));

        Assert.True(index.IsUnique);
    }

    [Fact]
    public void IdeaUpvote_HasCompositeUniqueIndexOnIdeaAndUser()
    {
        using var ctx = InMemoryContext.Create();
        var index = ctx.Model.FindEntityType(typeof(IdeaUpvote))!
            .GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name)
                .SequenceEqual(new[] { nameof(IdeaUpvote.IdeaId), nameof(IdeaUpvote.UserId) }));

        Assert.True(index.IsUnique);
    }

    [Fact]
    public void User_RoleAndStatus_AreStoredAsStrings()
    {
        using var ctx = InMemoryContext.Create();
        var entity = ctx.Model.FindEntityType(typeof(User))!;

        Assert.Equal(typeof(string), entity.FindProperty(nameof(User.Role))!.GetProviderClrType());
        Assert.Equal(typeof(string), entity.FindProperty(nameof(User.Status))!.GetProviderClrType());
    }
}
