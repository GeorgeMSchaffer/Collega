namespace Collega.Infrastructure.Persistence;

/// <summary>
/// Builds `LIKE` patterns from user-supplied search terms with the wildcard characters neutralised.
/// </summary>
/// <remarks>
/// <para>Interpolating a raw term into <c>$"%{term}%"</c> lets the user's own text act as pattern
/// syntax: a search for <c>50%</c> matches every row starting "50", <c>a_b</c> matches "axb", and on
/// SQL Server <c>[abc]</c> is a character class. The result is silently wrong matches and terms that
/// cannot be searched literally at all — a correctness bug rather than an injection one, since EF
/// still parameterises the value.</para>
///
/// <para>Every pattern built here is paired with an explicit <c>ESCAPE</c> clause via the
/// three-argument <c>EF.Functions.Like</c> overload; <see cref="EscapeCharacter"/> is that clause's
/// character. Escaping is applied to the escape character first, so an escape introduced by a later
/// replacement is never escaped a second time.</para>
///
/// <para><b>Case sensitivity (Sprint 5).</b> SQL Server's default <c>CI_AS</c> collation made
/// <c>LIKE</c> case-insensitive for free; PostgreSQL is case-sensitive, so the provider swap silently
/// broke the case-insensitive substring matching that <c>SPEC/30-Contracts.md</c> ("Matching is
/// case-insensitive substring") requires. Every search predicate therefore lowercases <em>both</em>
/// sides: the column via <c>.ToLower()</c> (which Npgsql translates to SQL <c>lower()</c>) and the
/// pattern via <see cref="ContainsCaseInsensitive"/> / <see cref="EscapeCaseInsensitive"/>.</para>
///
/// <para>Lowercasing rather than Npgsql's <c>EF.Functions.ILike</c> is deliberate. <c>ILike</c> is a
/// provider-specific translation with no client-side implementation: under the InMemory provider the
/// whole test suite runs on, it throws <c>InvalidOperationException</c> rather than evaluating. The
/// <c>lower()</c> form behaves identically on both, so in-memory tests exercise the same
/// case-insensitive semantics production gets instead of being blind to them. It is also the more
/// indexable of the two — Postgres can serve it from an expression index on <c>lower(column)</c>.</para>
///
/// <para><c>[</c> is a wildcard only in SQL Server, and escaping it is harmless in Postgres
/// (<c>\[</c> under an <c>ESCAPE</c> clause is a literal <c>[</c> either way). None of the escape
/// or wildcard characters are affected by case folding, so lowercasing a pattern after escaping it
/// is safe in either order.</para>
/// </remarks>
internal static class LikePattern
{
    /// <summary>The character supplied to the SQL <c>ESCAPE</c> clause.</summary>
    public const string EscapeCharacter = "\\";

    /// <summary>Wraps a term for a "contains" match: <c>%term%</c>, wildcards escaped.</summary>
    public static string Contains(string? term) => $"%{Escape(term)}%";

    /// <summary>
    /// <see cref="Contains"/> lowercased, for matching against a <c>.ToLower()</c> column.
    /// </summary>
    public static string ContainsCaseInsensitive(string? term) => $"%{EscapeCaseInsensitive(term)}%";

    /// <summary>
    /// <see cref="Escape"/> lowercased, for matching against a <c>.ToLower()</c> column.
    /// </summary>
    public static string EscapeCaseInsensitive(string? term) => Escape(term).ToLowerInvariant();

    /// <summary>Neutralises `LIKE` wildcards so the term matches literally.</summary>
    public static string Escape(string? term) => string.IsNullOrEmpty(term)
        ? string.Empty
        : term
            // Escape character first — otherwise the backslashes added below get escaped again.
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_")
            .Replace("[", "\\[");
}
