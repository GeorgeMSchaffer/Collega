import type { Role, UserStatus } from '@collega/domain/enums'

export type LoginCommand = {
  readonly email: string
  readonly password: string
}

export type ChangePasswordCommand = {
  readonly currentPassword: string
  readonly newPassword: string
}

export type UpdateProfileCommand = {
  readonly firstName: string
  readonly lastName: string
}

export type RegisterCommand = {
  readonly inviteCode: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly password: string
}

/**
 * Present on `GET /auth/me` only while a View As session is live. The client renders the
 * persistent banner from this rather than from remembered local state, so a session ended or
 * expired server-side cannot leave a stale banner on screen (SPEC/30-Contracts.md -> View As).
 *
 * Populated by the API layer from the token's resolved `AuthenticatedPrincipal.impersonation`
 * (Wave D), not by this slice's `AuthService.getCurrentUser` - see the slice report.
 */
export type ViewingAsSummary = {
  readonly realUserId: string
  readonly realUserName: string
  readonly startedAtUtc: Date
  readonly expiresAtUtc: Date
}

/** Shape matches `GET /api/v1/auth/me` (SPEC/30-Contracts.md) property-for-property. */
export type CurrentUserSummary = {
  readonly userId: string
  readonly organizationId: string | null
  readonly role: Role
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly status: UserStatus
  readonly portraitDataUrl: string | null
  readonly viewingAs: ViewingAsSummary | null
}

/** Shape matches the `POST /api/v1/auth/login` success response. */
export type LoginResult = {
  readonly accessToken: string
  readonly expiresInSeconds: number
  readonly requiresPasswordChange: boolean
  readonly user: CurrentUserSummary
}

/** Shape matches the `POST /api/v1/auth/register` success response. */
export type RegisterResult = {
  readonly userId: string
  readonly organizationId: string
  readonly email: string
  readonly role: Role
  readonly status: UserStatus
}

/** Shape matches the `POST /api/v1/users/{userId}/temporary-password` success response. */
export type TemporaryPasswordResult = {
  readonly temporaryPassword: string
  readonly mustChangePassword: boolean
}

/** The real administrator behind an active View As session, and when it must end. */
export type ImpersonationContext = {
  readonly realUserId: string
  readonly realUserFirstName: string
  readonly realUserLastName: string
  readonly startedAtUtc: Date
  readonly expiresAtUtc: Date
}

/**
 * Resolved identity for a validated bearer token, built fresh from persisted state on every
 * request so a mid-session deactivation or role change takes effect immediately rather than
 * trusting stale token claims.
 *
 * While a View As session is active, every field here describes the IMPERSONATED user - that is
 * what makes existing org-scoping and role checks apply unchanged (SPEC/20-feature-view-as.md
 * rule 4) - and `impersonation` carries the real administrator alongside, for audit and for the
 * banner.
 */
export type AuthenticatedPrincipal = {
  readonly userId: string
  readonly organizationId: string | null
  readonly role: Role
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly status: UserStatus
  /**
   * Live persisted state, not a token claim, so a rotation completed in another tab lifts the
   * restriction on the next request. The API refuses all but a small allowlist of endpoints
   * while this is true (auth requirement #31); the client's own gate is a UX convenience on top
   * of it.
   */
  readonly mustChangePassword: boolean
  readonly impersonation: ImpersonationContext | null
}
