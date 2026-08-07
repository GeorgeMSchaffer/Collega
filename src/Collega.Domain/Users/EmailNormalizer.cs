namespace Collega.Domain.Users;

/// <summary>
/// Email is globally unique across the whole system (SPEC/20-feature-auth.md #2). Uniqueness
/// checks and lookups are always performed against the normalized (trimmed, lowercased) form so
/// callers never need to duplicate this rule.
/// </summary>
public static class EmailNormalizer
{
    public static string Normalize(string email) => (email ?? string.Empty).Trim().ToLowerInvariant();
}
