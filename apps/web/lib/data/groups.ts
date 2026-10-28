/**
 * The organization's groups (`SPEC/20-feature-board-access-and-groups.md` BAG-1;
 * `contracts/groups.md`). Every member may read them, since a board's access list names them.
 */

import { toGroupDetail, toGroupOverview } from '../api/adapt'
import { apiGet, apiPath, isApiStatus } from '../api/client'
import type { WireGroupDetail, WireGroupListItem } from '../api/wire'
import type { GroupDetail, GroupOverview } from '../types'
import { failIfRequested } from './latency'
import { organizationScope } from './scope'

export type { GroupDetail, GroupMember, GroupOverview } from '../types'

/** Every group in the reader's organization, by name. Empty for a Site Admin acting directly. */
export async function getGroups(): Promise<GroupOverview[]> {
  failIfRequested('getGroups')

  const scope = organizationScope()
  if (scope === null) return []

  const items = await apiGet<readonly WireGroupListItem[]>(
    'getGroups',
    apiPath`/organizations/${scope}/groups`,
  )
  return items.map(toGroupOverview)
}

/** One group with its members and boards, or null for one the reader cannot reach. */
export async function getGroup(id: string): Promise<GroupDetail | null> {
  failIfRequested('getGroup')

  try {
    return toGroupDetail(await apiGet<WireGroupDetail>('getGroup', apiPath`/groups/${id}`))
  } catch (error) {
    if (isApiStatus(error, 404)) return null
    throw error
  }
}

/**
 * Every group with its members, for the board form's Access section: the head count needs to know
 * who each group holds. One request per group, which the organization's handful can afford.
 */
export async function getGroupsWithMembers(): Promise<GroupDetail[]> {
  const groups = await getGroups()
  const details = await Promise.all(groups.map((group) => getGroup(group.id)))
  return details.filter((group): group is GroupDetail => group !== null)
}
