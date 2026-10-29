import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GroupsPage from '@/app/(desk)/settings/groups/page'
import SettingsHub from '@/app/(desk)/settings/page'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * Who reaches Settings → Groups and what the page hands the screen (BAG-6a): every member reads it
 * (no administrator gate), only an Org Admin gets the member list and `canManage`, and the Settings
 * hub offers the Groups card to members as well as administrators. The data seam is the boundary.
 */
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/analytics/usage-viewed', () => ({ UsageViewed: () => null }))
const screenProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@/components/settings/groups-screen', () => ({
  GroupsScreen: (props: Record<string, unknown>) => {
    screenProps.current = props
    return <div data-testid="groups-screen" />
  },
  NewGroupButton: ({ canManage }: { canManage: boolean }) => (
    <span data-testid="new-group">{String(canManage)}</span>
  ),
}))
const data = vi.hoisted(() => ({
  getGroups: vi.fn(),
  getGroup: vi.fn(),
  getMembersForOrganization: vi.fn(),
}))
vi.mock('@/lib/data', () => data)

beforeEach(() => {
  screenProps.current = null
  data.getGroups.mockReset().mockResolvedValue([])
  data.getGroup.mockReset().mockResolvedValue(null)
  data.getMembersForOrganization.mockReset().mockResolvedValue([
    { id: 'u-2', displayName: 'Zed', roleLabel: 'User', status: 'Active' },
    { id: 'u-1', displayName: 'Abe', roleLabel: 'User', status: 'Deactivated' },
  ])
})

const open = async (role: Role, search: Record<string, string> = {}) => {
  actAs(role)
  render((await GroupsPage({ searchParams: Promise.resolve(search) })) as ReactElement)
}

describe('the Groups page', () => {
  it.each(['OrgAdmin', 'User', 'ReadOnly'] as const)('renders the screen for %s', async (role) => {
    await open(role)
    expect(screen.getByTestId('groups-screen')).toBeTruthy()
    expect(screen.queryByText('Not available')).toBeNull()
  })

  it('gives an Org Admin canManage and the organization sorted, with status', async () => {
    await open('OrgAdmin')
    expect(screenProps.current).toMatchObject({
      canManage: true,
      people: [
        { id: 'u-1', name: 'Abe', roleLabel: 'User', active: false },
        { id: 'u-2', name: 'Zed', roleLabel: 'User', active: true },
      ],
    })
    expect(screen.getByTestId('new-group').textContent).toBe('true')
  })

  it.each(['User', 'ReadOnly'] as const)(
    'gives %s a read-only screen and does not read the member list',
    async (role) => {
      await open(role)
      expect(screenProps.current).toMatchObject({ canManage: false, people: [] })
      expect(data.getMembersForOrganization).not.toHaveBeenCalled()
      expect(screen.getByTestId('new-group').textContent).toBe('false')
    },
  )

  it('reads the group named in the URL, but not for ?group=new', async () => {
    await open('OrgAdmin', { group: 'g-1' })
    expect(data.getGroup).toHaveBeenCalledWith('g-1')
    data.getGroup.mockClear()
    await open('OrgAdmin', { group: 'new' })
    expect(data.getGroup).not.toHaveBeenCalled()
  })

  it('offers an App Admin no New group button, only the lead to View As', async () => {
    await open('SiteAdmin')
    expect(screen.queryByTestId('new-group')).toBeNull()
    expect(screen.getByText(/Use View As/)).toBeTruthy()
  })
})

describe('the Settings hub', () => {
  it.each(['OrgAdmin', 'User', 'ReadOnly'] as const)('links Groups for %s', async (role) => {
    actAs(role)
    render((await SettingsHub()) as ReactElement)
    const link = screen.getByRole('link', { name: 'Groups' })
    expect(link.getAttribute('href')).toBe('/settings/groups')
  })
})
