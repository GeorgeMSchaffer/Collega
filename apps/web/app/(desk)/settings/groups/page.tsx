import type { GroupPerson } from '@/components/settings/group-drawer'
import { GroupsScreen, NewGroupButton } from '@/components/settings/groups-screen'
import { SettingsPage } from '@/components/settings/settings-page'
import { type GroupDetail, getGroup, getGroups, getMembersForOrganization } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Groups · Collega' }

type Search = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Settings → Groups (`/settings/groups`, BAG-6a). Open to every member of the organization, since
 * a board's access list names groups; only an Org Admin changes them (BAG-1b). A Site Admin acting
 * directly belongs to no organization and is pointed at View As.
 *
 * The open group is read here, from the URL the drawer writes: `?group={id}`.
 */
export default async function GroupsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const search = await searchParams
  const user = currentUser()
  const siteAdmin = user.role === 'SiteAdmin'
  const canManage = user.role === 'OrgAdmin'
  const requested = first(search.group)

  const [groups, openGroup, members] = await Promise.all([
    getGroups(),
    requested && requested !== 'new' ? getGroup(requested) : Promise.resolve(null),
    canManage && user.organizationId
      ? getMembersForOrganization(user.organizationId)
      : Promise.resolve([]),
  ])
  const people: GroupPerson[] = members
    .map((member) => ({
      id: member.id,
      name: member.displayName,
      roleLabel: member.roleLabel,
      active: member.status === 'Active',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <SettingsPage
      title="Groups"
      gate="groups"
      openToMembers
      lead={
        siteAdmin
          ? 'Groups belong to an organization. Use View As to see or change one’s groups.'
          : 'Named sets of people. Give a group access to a Restricted board once; when someone joins or leaves the group, every board it is on follows.'
      }
      actions={siteAdmin ? null : <NewGroupButton canManage={canManage} />}
    >
      <GroupsScreen
        groups={groups}
        canManage={canManage}
        openGroup={openGroup satisfies GroupDetail | null}
        people={people}
      />
    </SettingsPage>
  )
}
