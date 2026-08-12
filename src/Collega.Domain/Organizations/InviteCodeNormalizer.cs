namespace Collega.Domain.Organizations;

/// <summary>
/// Invite codes are generated from an uppercase ASCII alphabet, so a code transcribed from an email
/// in any other case must still match. Normalizing (trimmed, uppercased) before every comparison and
/// before persistence keeps that true in code rather than relying on a case-insensitive database
/// collation — PostgreSQL compares case-sensitively, unlike the SQL Server default this replaced.
/// </summary>
/// <remarks>
/// Uppercase (rather than lowercase) is the canonical form so stored codes stay in the alphabet
/// <c>InviteCodeGenerator</c> draws from. Casing is invariant: the code is ASCII, and Turkish
/// culture would map <c>i</c> to <c>İ</c>.
/// </remarks>
public static class InviteCodeNormalizer
{
    public static string Normalize(string inviteCode) => (inviteCode ?? string.Empty).Trim().ToUpperInvariant();
}
