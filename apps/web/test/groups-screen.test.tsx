import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GroupsScreen, NewGroupButton } from '@/components/settings/groups-screen'
import { deleteGroup, saveGroup } from '@/lib/server/group-actions'
import type { GroupDetail, GroupOverview } from '@/lib/types'
import { stubDialogMethods } from './support/dialog'

stubDialogMethods()

/**
 * Settings → Groups (BAG-6a): an Org Admin changes groups, everyone else reads; the drawer's save
 * hands the action the form's fields; deleting asks first and names the boards the group is on.
 * The server actions and the router are the boundary.
 */
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/settings/groups',
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/server/group-actions', () => ({
  saveGroup: vi.fn(),
  deleteGroup: vi.fn(),
}))

const GROUPS: GroupOverview[] = [
  { id: 'g-1', name: 'Core team', description: 'Product core', memberCount: 2, boardCount: 2 },
  { id: 'g-2', name: 'Pilots', description: null, memberCount: 0, boardCount: 0 },
]

function detail(over: Partial<GroupDetail> = {}): GroupDetail {
  return {
    ...GROUPS[0],
    members: [
      {
        id: 'u-1',
        name: 'Ada Lovelace',
        email: 'ada@x.test',
        role: 'User',
        roleLabel: 'User',
        active: true,
      },
      {
        id: 'u-2',
        name: 'Bob Stone',
        email: 'bob@x.test',
        role: 'User',
        roleLabel: 'User',
        active: true,
      },
    ],
    boards: [
      { id: 'b-1', name: 'Opportunities', isArchived: false },
      { id: 'b-2', name: 'Assembly', isArchived: false },
    ],
    canManage: true,
    ...over,
  } as GroupDetail
}

const PEOPLE = [
  { id: 'u-1', name: 'Ada Lovelace', roleLabel: 'User', active: true },
  { id: 'u-2', name: 'Bob Stone', roleLabel: 'User', active: true },
  { id: 'u-3', name: 'Cy Young', roleLabel: 'User', active: true },
]

function show(
  props: { canManage: boolean; openGroup?: GroupDetail | null; groups?: GroupOverview[] },
  query = '',
) {
  nav.params = new URLSearchParams(query)
  return render(
    <GroupsScreen
      groups={props.groups ?? GROUPS}
      canManage={props.canManage}
      openGroup={props.openGroup ?? null}
      people={props.canManage ? PEOPLE : []}
    />,
  )
}

beforeEach(() => {
  nav.push.mockReset()
  vi.mocked(saveGroup).mockReset().mockResolvedValue({ error: null, errors: {}, savedId: 'g-1' })
  vi.mocked(deleteGroup).mockReset().mockResolvedValue({ error: null })
})

describe('the New group button', () => {
  it('opens the new-group drawer for an Org Admin', () => {
    render(<NewGroupButton canManage />)
    fireEvent.click(screen.getByRole('button', { name: 'New group' }))
    expect(nav.push).toHaveBeenCalledWith('/settings/groups?group=new', { scroll: false })
  })

  it('is replaced by an explanation for anyone else', () => {
    render(<NewGroupButton canManage={false} />)
    expect(screen.queryByRole('button', { name: 'New group' })).toBeNull()
    expect(screen.getByText('Only Org Admins can change groups.')).toBeTruthy()
  })
})

describe('the groups list', () => {
  it('shows each group with its member and board counts, and a dash for none', () => {
    show({ canManage: false })
    const core = screen.getByRole('row', { name: /Core team/ })
    expect(within(core).getAllByRole('cell').map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['2']),
    )
    const pilots = screen.getByRole('row', { name: /Pilots/ })
    expect(within(pilots).getByText('—')).toBeTruthy()
  })

  it('never offers row Edit or Delete, to an Org Admin or anyone else, only View', () => {
    for (const canManage of [true, false]) {
      const view = show({ canManage })
      expect(screen.getByRole('button', { name: 'View Core team' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Edit Core team' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Delete Core team' })).toBeNull()
      view.unmount()
    }
  })

  it('tells a member with no groups to ask an Org Admin, and an Org Admin to create one', () => {
    const first = show({ canManage: false, groups: [] })
    expect(screen.getByText('An Org Admin has not created any groups.')).toBeTruthy()
    first.unmount()
    show({ canManage: true, groups: [] })
    expect(screen.getByText('Create one, then add it to a Restricted board.')).toBeTruthy()
  })
})

describe('the group drawer for a reader', () => {
  it('shows the group read-only: no Save, Delete, member picker or remove buttons', () => {
    show({ canManage: false, openGroup: detail({ canManage: false }) }, 'group=g-1')
    const drawer = screen.getByRole('complementary')
    expect(within(drawer).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
    expect(within(drawer).queryByRole('button', { name: 'Save' })).toBeNull()
    expect(within(drawer).queryByRole('button', { name: /Delete/ })).toBeNull()
    expect(within(drawer).queryByPlaceholderText('Add people')).toBeNull()
    expect(within(drawer).queryByRole('button', { name: /^Remove / })).toBeNull()
    expect((within(drawer).getByLabelText(/Name/) as HTMLInputElement).readOnly).toBe(true)
    expect(within(drawer).getByText('Ada Lovelace')).toBeTruthy()
  })

  it('does not open a new-group drawer from the URL', () => {
    show({ canManage: false }, 'group=new')
    // The drawer stays mounted while closed, but with no form in it.
    expect(screen.queryByLabelText(/Name/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create group' })).toBeNull()
  })
})

describe('the group drawer for an Org Admin', () => {
  it('saves the name, description and member ids the form holds, and opens the saved group', async () => {
    show({ canManage: true, openGroup: detail() }, 'group=g-1')
    const drawer = screen.getByRole('complementary')

    fireEvent.change(within(drawer).getByLabelText(/Name/), { target: { value: 'Core crew' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Remove Bob Stone' }))
    const picker = within(drawer).getByPlaceholderText('Add people')
    fireEvent.focus(picker)
    fireEvent.change(picker, { target: { value: 'Cy' } })
    fireEvent.click(await within(drawer).findByRole('option', { name: /Cy Young/ }))
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(saveGroup).toHaveBeenCalledTimes(1))
    const [groupId, data] = vi.mocked(saveGroup).mock.calls[0] as [string, FormData]
    expect(groupId).toBe('g-1')
    expect(data.get('name')).toBe('Core crew')
    expect(data.get('description')).toBe('Product core')
    expect(data.getAll('userIds').sort()).toEqual(['u-1', 'u-3'])
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/settings/groups?group=g-1', { scroll: false }))
  })

  it('creates a group with a null id from the new-group drawer', async () => {
    show({ canManage: true }, 'group=new')
    const drawer = screen.getByRole('complementary')
    fireEvent.change(within(drawer).getByLabelText(/Name/), { target: { value: 'Pilots 2' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create group' }))

    await waitFor(() => expect(saveGroup).toHaveBeenCalledTimes(1))
    const [groupId, data] = vi.mocked(saveGroup).mock.calls[0] as [null, FormData]
    expect(groupId).toBeNull()
    expect(data.get('name')).toBe('Pilots 2')
    expect(data.getAll('userIds')).toEqual([])
  })

  it('shows a refused save in the drawer, beside the field it names', async () => {
    vi.mocked(saveGroup).mockResolvedValue({
      error: null,
      errors: { name: 'A group named that already exists.' },
      savedId: null,
    })
    show({ canManage: true, openGroup: detail() }, 'group=g-1')
    const drawer = screen.getByRole('complementary')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))

    expect(await within(drawer).findByText('A group named that already exists.')).toBeTruthy()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('shows a refusal with no field in the drawer banner', async () => {
    vi.mocked(saveGroup).mockResolvedValue({
      error: 'Only an Org Admin can change groups.',
      errors: {},
      savedId: null,
    })
    show({ canManage: true, openGroup: detail() }, 'group=g-1')
    const drawer = screen.getByRole('complementary')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))

    expect(await within(drawer).findByText('Only an Org Admin can change groups.')).toBeTruthy()
  })
})

describe('deleting a group', () => {
  function askToDelete(group: GroupDetail) {
    show({ canManage: true, openGroup: group }, 'group=g-1')
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /Delete/ }))
  }

  it('asks first, names every board the group is on, and deletes nothing yet', () => {
    askToDelete(detail())
    const text = document.body.textContent ?? ''
    expect(text).toContain('Delete Core team?')
    expect(text).toContain('It is on Opportunities, Assembly.')
    expect(text).toContain('those boards')
    expect(deleteGroup).not.toHaveBeenCalled()
  })

  it('says so when the group is on no board the reader can see', () => {
    askToDelete(detail({ boards: [] }))
    expect(document.body.textContent).toContain('It is not on any board you can see.')
  })

  it('does not delete when cancelled', () => {
    askToDelete(detail())
    fireEvent.click(within(document.querySelector('dialog') as HTMLElement).getByRole('button', { name: 'Cancel', hidden: true }))
    expect(deleteGroup).not.toHaveBeenCalled()
  })

  it('deletes once confirmed and closes the drawer', async () => {
    askToDelete(detail())
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }))
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith('g-1'))
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/settings/groups', { scroll: false }))
  })

  it('shows the API refusal in an alert and leaves the drawer open', async () => {
    vi.mocked(deleteGroup).mockResolvedValue({ error: 'The group is gone.' })
    askToDelete(detail())
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The group is gone.')
    expect(nav.push).not.toHaveBeenCalled()
  })
})
