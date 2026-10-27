// Persistence ports for groups (SPEC/contracts/groups.md). Infrastructure implements these against
// Prisma; this feature depends only on the shapes below.

import type { BoardVisibility } from '@collega/domain/enums'
import type { Group } from '@collega/domain/groups'
import type { User } from '@collega/domain/users'

/** A Restricted board granted to a group, with what `canSeeBoard` needs to decide whether the
 * caller may see it. */
export type GroupBoardGrant = {
  readonly groupId: string
  readonly board: {
    readonly id: string
    readonly name: string
    readonly isArchived: boolean
    readonly organizationId: string
    readonly visibility: BoardVisibility
    readonly createdByUserId: string | null
    readonly accessUserIds: readonly string[]
    readonly accessGroupIds: readonly string[]
  }
}

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

  /** The Restricted boards whose access list names any of `groupIds`, one entry per pair. */
  listRestrictedBoardGrants(groupIds: readonly string[]): Promise<readonly GroupBoardGrant[]>

  /** The groups the user belongs to. */
  listGroupIdsForUser(userId: string): Promise<readonly string[]>
}

/** Satisfied by the users feature's `UserRepository`. Ids that do not exist are absent. */
export interface GroupMemberLookup {
  listByIds(userIds: readonly string[]): Promise<readonly User[]>
}

export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
