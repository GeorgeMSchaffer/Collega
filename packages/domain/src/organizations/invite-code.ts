// Invite codes are generated from an uppercase ASCII alphabet, so a code transcribed from an
// email in any other case must still match. Normalizing (trimmed, uppercased) before every
// comparison and before persistence keeps that true in code rather than relying on a
// case-insensitive database collation - Postgres compares case-sensitively.
//
// Uppercase (rather than lowercase) is the canonical form so stored codes stay in the alphabet
// the generator draws from. Casing is invariant: the code is ASCII, so there is no Turkish-i
// concern the way there would be with locale-aware case conversion.
export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase()
}
