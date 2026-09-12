import type { Role, UserStatus } from '@collega/domain/enums'
import type { User } from '@collega/domain/users'
import type { PageRequest } from '../common/index.js'

/** Store-facing filter for org-scoped user listing. */
export type UserListFilter = {
  readonly organizationId: string
  readonly page: PageRequest
  readonly search: string | null
  readonly role: Role | null
  readonly status: UserStatus | null
  readonly sortBy: string | null
  readonly sortDirection: string | null
}

/** A page of users plus the sort actually applied - the store resolves the default sort, so the
 * result carries it back rather than the caller guessing. */
export type UserPage = {
  readonly items: readonly User[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: string | null
  readonly sortDirection: string
}

export interface UserRepository {
  getById(userId: string): Promise<User | null>
  getByNormalizedEmail(normalizedEmail: string): Promise<User | null>
  existsByNormalizedEmail(normalizedEmail: string): Promise<boolean>
  anySiteAdmin(): Promise<boolean>
  /** Paged user list within one organization (SPEC/30-Contracts.md org users list). */
  listByOrganization(filter: UserListFilter): Promise<UserPage>
  /** Loads users by their ids. Used by the Collaboration slice to validate idea assignees and
   * to project assignee/mention display names without an N+1 lookup. */
  listByIds(userIds: readonly string[]): Promise<readonly User[]>
  /** Users the View As picker may offer. `organizationId` is null for a Site Admin (all
   * organizations) and set for an Org Admin, so the scope restriction is applied in the query
   * rather than filtered afterwards - an Org Admin's result set never contains a user they may
   * not target. */
  searchForImpersonation(
    organizationId: string | null,
    search: string | null,
  ): Promise<readonly User[]>
  /** Number of active OrgAdmin users in an organization, used to enforce the last-Org-Admin
   * safeguard (org-and-users requirement #8). */
  countActiveOrgAdmins(organizationId: string, excludingUserId?: string | null): Promise<number>
  add(user: User): Promise<void>
  /** Persists changes to a user already added - the domain functions return a new immutable
   * value rather than mutating in place, so update is its own call. */
  update(user: User): Promise<void>
}

/**
 * Narrow existence check so this feature does not need to depend on the Organizations
 * partition's full repository port just to answer "does this organization id exist".
 */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}

// Clock, UnitOfWork, and AuditEventWriter/AuditEventInput come from the shared kernel
// (packages/application/src/common) - not redeclared here. PasswordHasher is declared once, in
// ../auth/ports.js, and imported here rather than duplicated.
