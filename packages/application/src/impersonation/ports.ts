import type { Role, UserStatus } from '@collega/domain/enums'
import type { ImpersonationSession } from '@collega/domain/impersonation'

/**
 * Persists View As sessions. `getOpenForRealUser` is a courtesy read for a clear error message,
 * not the enforcement of rule 5 (non-nestable) - the partial unique index
 * `ux_impersonation_sessions_real_user_id_open` (`ended_at_utc IS NULL`) is what actually
 * guarantees at most one open session per real user, since two concurrent starts can both pass
 * this read-then-write check. See ViewAsService.start for how the losing request's constraint
 * violation is turned into the same 409 the winner's check would have produced.
 */
export interface ImpersonationSessionRepository {
  getOpenForRealUser(realUserId: string): Promise<ImpersonationSession | null>

  add(session: ImpersonationSession): Promise<void>

  /** Persists a session already returned by this repository. Ending or touching a session
   * produces a new immutable value (packages/domain holds no mutable entities), so every
   * transition is followed by an explicit `update`. */
  update(session: ImpersonationSession): Promise<void>
}

/**
 * The subset of a user's fields View As needs. Deliberately narrow and declared locally rather
 * than imported from `@collega/application/users`' `UserRepository` - each Wave B feature slice
 * defines the port shape it needs, and Wave C satisfies all of them with the same concrete
 * repository (see ideas/ports.ts's `UsersPort` for the precedent and its reasoning).
 */
export type ImpersonationUserSummary = {
  readonly id: string
  readonly organizationId: string | null
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: Role
  readonly status: UserStatus
}

export interface ImpersonationUsersPort {
  getById(userId: string): Promise<ImpersonationUserSummary | null>

  /** Users the View As picker may offer. `organizationId` is null for a Site Admin (every
   * organization) and set for an Org Admin, so the scope restriction is applied in the query
   * rather than filtered afterwards - an Org Admin's result set never contains a user they may
   * not target. Mirrors .NET's `IUserRepository.SearchForImpersonationAsync`. */
  searchForImpersonation(
    organizationId: string | null,
    search: string | null,
  ): Promise<readonly ImpersonationUserSummary[]>
}

export type ImpersonationOrganizationSummary = {
  readonly id: string
  readonly title: string
  readonly isArchived: boolean
}

export interface ImpersonationOrganizationsPort {
  getById(organizationId: string): Promise<ImpersonationOrganizationSummary | null>
}

// Clock and UnitOfWork come from the shared kernel (packages/application/src/common) - not
// redeclared here.
