// Persistence ports for groups (SPEC/contracts/groups.md). Infrastructure implements these against
// Prisma; this feature depends only on the shapes below.

import type { Group } from '@collega/domain/groups'
import type { User } from '@collega/domain/users'

export interface GroupRepository {
  add(group: Group): Promise<void>

  /** Persists a mutation made through `updateGroup` or `setGroupMembers`, members included. */
  save(group: Group): Promise<void>

  /** Hard delete; the memberships go with it. */
  delete(groupId: string): Promise<void>

  /** Single fetch, members loaded. */
  getById(groupId: string): Promise<Group | null>

  /** Every group of the organization, members loaded, in no guaranteed order. */
  listByOrganization(organizationId: string): Promise<readonly Group[]>

  /** Whether the organization already has a group of this name (trimmed, case-insensitive),
   * excluding `excludeId`. */
  existsByName(organizationId: string, name: string, excludeId: string | null): Promise<boolean>
}

/** Satisfied by the users feature's `UserRepository`. Ids that do not exist are absent. */
export interface GroupMemberLookup {
  listByIds(userIds: readonly string[]): Promise<readonly User[]>
}

export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
