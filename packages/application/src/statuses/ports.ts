// Persistence and infrastructure ports for status configuration. Wave C implements these against
// Prisma; this feature only depends on the shapes below, never on Prisma or Nest directly.

import type { Status } from '@collega/domain/statuses'

export interface StatusRepository {
  add(status: Status): Promise<void>

  /** Used once, at organization bootstrap, to provision the canonical default status set. */
  addMany(statuses: readonly Status[]): Promise<void>

  getById(statusId: string): Promise<Status | null>

  listActiveByOrganization(organizationId: string): Promise<readonly Status[]>

  /**
   * Lists an organization's statuses. When `includeDeleted` is false only active statuses are
   * returned; when true soft-deleted statuses are included so historical views can surface their
   * prior names with a deleted label (rule #8). Callers are responsible for ordering the result -
   * this port makes no ordering guarantee.
   */
  listByOrganization(organizationId: string, includeDeleted: boolean): Promise<readonly Status[]>

  /** Counts the organization's active (non-deleted) statuses for the 2-active floor (rule #7). */
  countActiveByOrganization(organizationId: string): Promise<number>

  /** Persists a mutation made through `updateStatus`, `setStatusSortOrder`, or `softDeleteStatus`. */
  save(status: Status): Promise<void>
}

/**
 * Narrow existence check so this feature does not need to depend on the Organizations
 * partition's full repository port just to answer "does this organization id exist".
 *
 * `Clock` and `AuditEventWriter` used to live here too; both moved to
 * `@collega/application/common` once every Wave B partition turned out to need them.
 */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
