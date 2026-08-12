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
/// <para><b>Sprint 5 note:</b> re-verify under PostgreSQL. <c>[</c> is a wildcard only in SQL
/// Server, and escaping it is harmless in Postgres (<c>\[</c> under an <c>ESCAPE</c> clause is a
/// literal <c>[</c> either way), but <c>LIKE</c> case-sensitivity differs between the engines and is
/// not something this helper addresses.</para>
/// </remarks>
internal static class LikePattern
{
    /// <summary>The character supplied to the SQL <c>ESCAPE</c> clause.</summary>
    public const string EscapeCharacter = "\\";

    /// <summary>Wraps a term for a "contains" match: <c>%term%</c>, wildcards escaped.</summary>
    public static string Contains(string? term) => $"%{Escape(term)}%";

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
