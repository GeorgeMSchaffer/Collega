import { getGroupsWithMembers, getMemberOptions, getMembersForOrganization } from '@/lib/data'
import { currentUser } from '@/lib/session'
import type { AccessSetup, BoardOverview, BoardWithLanes } from '@/lib/types'

/**
 * What the board form's Access section needs, read on the server beside the rest of the form.
 *
 * An Org Admin reads `/users`, whose rows carry role and status, so the section can leave Org
 * Admins out of the picker and count who can see the board. A User creating a board may not list
 * users and gets `/members` (active, no role); the section then shows no count rather than a wrong
 * one.
 */
export async function loadAccessSetup(board: {
  restricted: boolean
  userIds: string[]
  groupIds: string[]
  creator: { id: string; name: string } | null
}): Promise<AccessSetup> {
  const user = currentUser()
  const [groups, people] = await Promise.all([
    getGroupsWithMembers(),
    user.role === 'OrgAdmin' && user.organizationId
      ? getMembersForOrganization(user.organizationId).then((members) =>
          members.map((member) => ({
            id: member.id,
            name: member.displayName,
            role: member.role,
            active: member.status === 'Active',
          })),
        )
      : getMemberOptions().then((members) =>
          members.map((member) => ({ id: member.id, name: member.name, role: null, active: true })),
        ),
  ])

  return {
    ...board,
    organizationName: user.organizationName ?? 'your organization',
    readerId: user.userId,
    people: [...people].sort((a, b) => a.name.localeCompare(b.name)),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      memberIds: group.members.filter((member) => member.active).map((member) => member.id),
    })),
  }
}

/** The setup for a new board: open to everyone, its creator the reader. */
export function loadNewBoardAccess(): Promise<AccessSetup> {
  const user = currentUser()
  return loadAccessSetup({
    restricted: false,
    userIds: [],
    groupIds: [],
    creator: { id: user.userId, name: user.displayName },
  })
}

/**
 * The setup for an existing board, or undefined when the reader may not manage its access. The
 * creator comes from the list item, the only read that names them.
 */
export function loadBoardAccess(
  board: BoardWithLanes,
  overview: BoardOverview | undefined,
): Promise<AccessSetup> | undefined {
  if (!board.canManageAccess) return undefined
  return loadAccessSetup({
    restricted: board.restricted,
    userIds: board.accessUserIds,
    groupIds: board.accessGroupIds,
    creator:
      overview?.createdById && overview.createdBy
        ? { id: overview.createdById, name: overview.createdBy }
        : null,
  })
}
