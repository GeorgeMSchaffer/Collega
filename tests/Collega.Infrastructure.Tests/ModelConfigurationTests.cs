using Collega.Domain.Ai;
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

    /// <summary>
    /// Every read of the meter filters on organization and time, or on time alone (the daily budget
    /// gate, which runs before every model call). Without this index both become table scans on a
    /// table that only grows.
    /// </summary>
    [Fact]
    public void AiUsageRecord_IsIndexedOnOrganizationAndOccurredAt()
    {
        using var ctx = InMemoryContext.Create();
        var indexes = ctx.Model.FindEntityType(typeof(AiUsageRecord))!.GetIndexes().ToList();

        Assert.Contains(indexes, i => i.Properties.Select(p => p.Name)
            .SequenceEqual(new[] { nameof(AiUsageRecord.OrganizationId), nameof(AiUsageRecord.OccurredAtUtc) }));
        Assert.Contains(indexes, i => i.Properties.Count == 1
            && i.Properties[0].Name == nameof(AiUsageRecord.OccurredAtUtc));
    }

    /// <summary>
    /// Rates are decimal columns with real precision, not floats. Money read back as a rounded or
    /// drifting figure would misstate what an organization owes.
    /// </summary>
    [Fact]
    public void AiUsageRecord_StoresRatesAsDecimal_AndEnumsAsStrings()
    {
        using var ctx = InMemoryContext.Create();
        var entity = ctx.Model.FindEntityType(typeof(AiUsageRecord))!;

        // No value converter on the rates, so GetProviderClrType() is null and the CLR type is what
        // reaches the provider — decimal, with explicit precision rather than the provider default.
        foreach (var rate in new[] { nameof(AiUsageRecord.InputRatePerMillion), nameof(AiUsageRecord.OutputRatePerMillion) })
        {
            var property = entity.FindProperty(rate)!;
            Assert.Equal(typeof(decimal), property.ClrType);
            Assert.Equal(12, property.GetPrecision());
            Assert.Equal(6, property.GetScale());
        }

        Assert.Equal(typeof(string), entity.FindProperty(nameof(AiUsageRecord.Outcome))!.GetProviderClrType());
        Assert.Equal(typeof(string), entity.FindProperty(nameof(AiUsageRecord.KeySource))!.GetProviderClrType());
    }
}
