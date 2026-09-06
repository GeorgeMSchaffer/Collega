import type { Role } from '@collega/domain/enums'

/**
 * The identity the current request acts under. This is the SINGLE chokepoint for
 * "who is calling" on the API side: nothing outside apps/api/src/auth/ and the token
 * adapter reads a credential, which is what lets View As work without touching any
 * authorization code (SPEC/20-feature-view-as.md rules 4/4a). apps/web has its own,
 * separate chokepoint, which holds a credential but decides nothing.
 *
 * Reading credentials elsewhere silently opts that code out of impersonation. The Biome
 * override on this path makes that a lint error, and tools/arch asserts the allowlist.
 *
 * Nullable properties are deliberate: an anonymous request is legitimate (POST /auth/login),
 * and login-failure audit events are written with no authenticated context.
 */
export interface CurrentUserContext {
  readonly isAuthenticated: boolean

  /** The ACTING user. While a View As session is live this is the impersonated user. */
  readonly userId: string | null

  readonly organizationId: string | null
  readonly role: Role | null

  /** True while acting as someone else. */
  readonly isImpersonating: boolean

  /** The real administrator. Equals `userId` when not impersonating - never null when authenticated. */
  readonly realUserId: string | null
}
