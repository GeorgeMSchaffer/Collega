using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Users;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Collega.API.Tests;

/// <summary>
/// Asserts on the SQL the search predicates generate against the real Npgsql provider.
/// </summary>
/// <remarks>
/// <para>These are the only tests in the suite that can see either property under test. The rest of
/// the suite runs on the EF InMemory provider, which models neither collation nor an <c>ESCAPE</c>
/// clause: it evaluates <c>EF.Functions.Like</c> client-side and cannot distinguish the two-argument
/// overload from the three-argument one. A results-based in-memory test would pass whether or not
/// the fix is correct.</para>
///
/// <para><c>ToQueryString()</c> compiles the query and renders the SQL without opening a connection,
/// so no database is required and the tests stay hermetic. The connection string below is never
/// dialled.</para>
///
/// <para>What these tests prove: the generated SQL folds case on both sides and carries an
/// <c>ESCAPE</c> clause on every <c>LIKE</c>. What they do not prove: that Postgres then returns the
/// expected rows — that needs a live engine (Sprint 5 Testcontainers work) or manual verification.</para>
/// </remarks>
public sealed class SearchSqlGenerationTests
{
    /// <summary>Deliberately mixed-case, so the rendered pattern shows whether it was lowercased.</summary>
    private const string SearchTerm = "AcMe";

    private static CollegaDbContext NewNpgsqlContext()
    {
        var options = new DbContextOptionsBuilder<CollegaDbContext>()
            .UseNpgsql("Host=localhost;Database=collega_sqlgen;Username=none;Password=none")
            .Options;
        return new CollegaDbContext(options);
    }

    /// <summary>
    /// Every <c>LIKE</c> must be paired with a <c>ESCAPE '\'</c> and have both operands case-folded.
    /// Counting rather than substring-matching is what catches a single missed call site inside a
    /// large OR chain — the failure mode that reading the source is precisely the way to miss.
    /// </summary>
    /// <remarks>
    /// The escape assertion deliberately matches the escape <em>character</em>, not the keyword. On
    /// Npgsql the two-argument <c>EF.Functions.Like</c> overload does not omit the clause, it emits
    /// <c>ESCAPE ''</c> — an empty escape character, which leaves <c>%</c> and <c>_</c> in the term
    /// live exactly as a missing clause would. Asserting only on the presence of "ESCAPE" would pass
    /// against that regression.
    /// </remarks>
    private static void AssertCaseInsensitiveEscapedLike(string sql, int expectedLikeCount)
    {
        var likeCount = CountOccurrences(sql, "LIKE ");
        var escapeCount = CountOccurrences(sql, @"ESCAPE '\'");
        var lowerCount = CountOccurrences(sql, "lower(");

        Assert.Equal(expectedLikeCount, likeCount);
        Assert.Equal(likeCount, escapeCount);
        Assert.Equal(likeCount, lowerCount);

        // The counts above only prove the *column* side is folded. Every caller passes a mixed-case
        // term, so the rendered parameter pins the pattern side too: a call site that kept .ToLower()
        // on the column but reverted to the un-lowercased LikePattern.Contains would keep the counts
        // equal and pass without this.
        Assert.DoesNotContain(SearchTerm, sql, StringComparison.Ordinal);
        Assert.Contains(SearchTerm.ToLowerInvariant(), sql, StringComparison.Ordinal);
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var index = haystack.IndexOf(needle, StringComparison.Ordinal);
        while (index >= 0)
        {
            count++;
            index = haystack.IndexOf(needle, index + needle.Length, StringComparison.Ordinal);
        }

        return count;
    }

    [Fact]
    public void OrganizationSearch_EmitsCaseInsensitiveEscapedLike()
    {
        using var context = NewNpgsqlContext();

        var sql = EfOrganizationRepository.ApplySearch(context.Set<Organization>(), SearchTerm).ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 2);
    }

    [Fact]
    public void UserSearch_EmitsCaseInsensitiveEscapedLike()
    {
        using var context = NewNpgsqlContext();

        var sql = EfUserRepository.ApplySearch(context.Set<User>(), SearchTerm).ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 3);
    }

    [Fact]
    public void BoardIdeaTitleSearch_EmitsCaseInsensitiveEscapedLike()
    {
        using var context = NewNpgsqlContext();

        var sql = EfIdeaRepository.ApplyTitleSearch(context.Set<Idea>(), SearchTerm).ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 1);
    }

    /// <summary>
    /// Title, author first/last/full name, assignee first/last/full name, status name, and UDF value
    /// — nine <c>LIKE</c>s, each of which has to carry its own <c>ESCAPE</c> and case folding. This is
    /// the call site where the original two-argument-overload bug hid.
    /// </summary>
    [Fact]
    public void OrganizationIdeaAllColumnSearch_EmitsCaseInsensitiveEscapedLike()
    {
        using var context = NewNpgsqlContext();
        var repository = new EfIdeaRepository(context);
        var filter = new OrganizationIdeaListFilter(
            OrganizationId: Guid.NewGuid(),
            CreatedByUserId: null,
            AssignedToUserId: null,
            Page: new PageRequest(1, 20),
            Search: SearchTerm,
            SortBy: null,
            SortDirection: null,
            SearchTextFieldIds: new[] { Guid.NewGuid() });

        var sql = repository.ApplyAllColumnSearch(context.Set<Idea>(), filter).ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 9);
    }

    /// <summary>
    /// The created-date branch of the all-column search. EF prunes this predicate entirely when
    /// <c>SearchCreatedOnDate</c> is null, so the case above never renders its parameters; without
    /// this test nothing sees them. <c>created_at_utc</c> is <c>timestamptz</c>, for which Npgsql
    /// accepts only <c>DateTimeKind.Utc</c> — a <c>DateOnly.ToDateTime</c> result is Unspecified and
    /// threw at execution time, so an ISO-date search term 500'd.
    /// </summary>
    [Fact]
    public void OrganizationIdeaAllColumnSearch_WithIsoDateTerm_RendersUtcTimestampParameters()
    {
        using var context = NewNpgsqlContext();
        var repository = new EfIdeaRepository(context);
        var filter = new OrganizationIdeaListFilter(
            OrganizationId: Guid.NewGuid(),
            CreatedByUserId: null,
            AssignedToUserId: null,
            Page: new PageRequest(1, 20),
            Search: SearchTerm,
            SortBy: null,
            SortDirection: null,
            SearchTextFieldIds: new[] { Guid.NewGuid() },
            SearchCreatedOnDate: new DateOnly(2026, 8, 12));

        var query = repository.ApplyAllColumnSearch(context.Set<Idea>(), filter);
        var sql = query.ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 9);

        // Rendered as UTC instants, not bare local-looking timestamps.
        Assert.Contains("2026-08-12T00:00:00.0000000Z", sql, StringComparison.Ordinal);
        Assert.Contains("2026-08-13T00:00:00.0000000Z", sql, StringComparison.Ordinal);
    }

    [Fact]
    public void ContainsFieldFilter_EmitsCaseInsensitiveEscapedLike()
    {
        using var context = NewNpgsqlContext();
        var repository = new EfIdeaRepository(context);
        var filter = new IdeaFieldValueFilter(Guid.NewGuid(), IdeaFieldFilterKind.Contains, Value: SearchTerm);

        var sql = repository.ApplyFieldFilter(context.Set<Idea>(), filter).ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 1);
    }

    [Fact]
    public void MultiSelectContainsFieldFilter_EmitsCaseInsensitiveEscapedLike()
    {
        using var context = NewNpgsqlContext();
        var repository = new EfIdeaRepository(context);
        var filter = new IdeaFieldValueFilter(Guid.NewGuid(), IdeaFieldFilterKind.MultiSelectContains, Value: SearchTerm);

        var sql = repository.ApplyFieldFilter(context.Set<Idea>(), filter).ToQueryString();

        AssertCaseInsensitiveEscapedLike(sql, expectedLikeCount: 1);
    }

    /// <summary>
    /// The escaping itself: a term containing SQL wildcards must reach the database as literal text,
    /// with the pattern lowercased so it can match a <c>lower()</c>-folded column.
    /// </summary>
    [Fact]
    public void SearchTerm_WildcardsAreEscaped_AndPatternIsLowercased()
    {
        using var context = NewNpgsqlContext();

        var sql = EfOrganizationRepository.ApplySearch(context.Set<Organization>(), "100%_A").ToQueryString();

        Assert.Contains("'%100\\%\\_a%'", sql, StringComparison.Ordinal);
    }
}
