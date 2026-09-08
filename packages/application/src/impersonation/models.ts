import type { Role, UserStatus } from '@collega/domain/enums'
import type { CurrentUserSummary } from '../auth/models.js'

/**
 * Response of starting a session. Carries both identities inline, per SPEC/30-Contracts.md ->
 * View As: the caller can render the banner and the rail from this alone, without a follow-up
 * `GET /auth/me`.
 *
 * `CurrentUserSummary` (from `../auth/models.js`) is reused rather than redeclared - "same shape
 * `GET /auth/me` returns, so a client can bind both with one type" is the .NET original's own
 * comment for why. `portraitDataUrl` and `viewingAs` are always null on both identities here,
 * exactly as the golden corpus records (`auth.viewas.start.json`): View As's own responses never
 * carry a portrait, and neither identity is itself mid-session at the moment this call returns.
 */
export type ViewAsSessionResult = {
  readonly impersonating: CurrentUserSummary
  readonly realUser: CurrentUserSummary
  readonly startedAtUtc: Date
  readonly expiresAtUtc: Date
}

/**
 * A row in the View As picker. `selectable` is false for users the picker shows but may not be
 * acted as - inactive accounts, or members of an archived organization. The server refuses them
 * on start regardless of this flag; it exists so the UI can grey them out rather than hide them
 * (rule 21).
 */
export type ViewAsCandidate = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: Role
  readonly status: UserStatus
  readonly organizationId: string
  readonly organizationName: string
  readonly selectable: boolean
}
