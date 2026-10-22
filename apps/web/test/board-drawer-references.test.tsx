import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardFormData, BoardView } from '@/components/boards/board-drawer'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { boardAdminDenial, boardCreateDenial, type Role } from '@/lib/roles'
import { createBoardInPlace, saveBoardInPlace } from '@/lib/server/board-actions'
import { SessionProvider } from '@/lib/session-client'
import type { BoardOverview, CurrentUser, LaneFlags, ReferenceContext } from '@/lib/types'

/**
 * What each role gets from the Boards drawer's lane editor (slice 288). The server actions and the router are the boundary.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards',
  useSearchParams: () => search.params,
}))
vi.mock('@/lib/server/board-actions', () => ({
  setBoardArchived: vi.fn(),
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))

const save = vi.mocked(saveBoardInPlace)
const create = vi.mocked(createBoardInPlace)

beforeEach(() => {
  search.params = new URLSearchParams()
  save.mockReset().mockResolvedValue({ error: null, savedId: 'b-1' })
  create.mockReset().mockResolvedValue({ error: null, savedId: 'b-new' })
})

const NONE: LaneFlags = { isFinal: false, referencesBoardId: null, autoCreateTask: false }
const STATUSES = [
  { id: 's-new', name: 'New', color: '#111111' },
  { id: 's-done', name: 'Done', color: '#222222' },
]
const CONTEXT: ReferenceContext = {
  choices: [
    {
      id: 'b-impl',
      name: 'Implementation',
      keyPrefix: 'IMPL',
      firstLaneName: 'Todo',
      hasReferenceLane: false,
    },
  ],
  referencedBy: [],
}

function overview(over: Partial<BoardOverview> = {}): BoardOverview {
  return {
    id: 'b-1',
    name: 'Discovery',
    description: null,
    ideaCount: 0,
    laneCount: 2,
    createdAtUtc: '2026-09-01T00:00:00.000Z',
    createdOn: '1 Sep 2026',
    createdBy: null,
    lanes: [],
    topTags: [],
    tagCount: 0,
    userStatusMoves: false,
    isArchived: false,
    archivedOn: null,
    keyPrefix: 'DISC',
    sprintsEnabled: false,
    ideaFeaturesEnabled: true,
    ...over,
  }
}

const VIEW: BoardView = {
  boardId: 'b-1',
  lanes: STATUSES,
  flags: { 's-new': { ...NONE, referencesBoardId: 'b-impl', autoCreateTask: true } },
  references: CONTEXT,
}

const FORM: BoardFormData = {
  boardId: 'b-1',
  name: 'Discovery',
  description: '',
  userStatusMoves: false,
  swimlaneIds: ['s-new', 's-done'],
  laneFlags: { 's-new': { ...NONE, referencesBoardId: 'b-impl' } },
  laneIdeaCounts: {},
  ideaFeaturesEnabled: true,
  references: CONTEXT,
  statuses: STATUSES,
}

function user(role: Role): CurrentUser {
  return {
    userId: `user-${role}`,
    displayName: role,
    initials: 'XX',
    role,
    roleLabel: role,
    organizationId: role === 'SiteAdmin' ? null : 'org-1',
    organizationName: role === 'SiteAdmin' ? null : 'Acme',
    viewingAs: null,
  }
}

function screenAs(
  role: Role,
  props: { board?: BoardOverview; form?: BoardFormData | null; view?: BoardView | null } = {},
) {
  const children: ReactNode = (
    <BoardsScreen
      boards={[props.board ?? overview()]}
      adminDenial={boardAdminDenial(role)}
      createDenial={boardCreateDenial(role)}
      form={props.form ?? null}
      view={props.view === undefined ? VIEW : props.view}
    />
  )
  return render(<SessionProvider user={user(role)}>{children}</SessionProvider>)
}

const dialog = () => screen.getByRole('complementary')

describe('the Boards drawer in view mode, by role', () => {
  const BANNER = 'You can see this board’s settings but only an Org Admin can change them.'

  beforeEach(() => {
    search.params = new URLSearchParams('board=b-1')
  })

  it('gives an Org Admin the lanes as values with an Edit button and no banner', () => {
    screenAs('OrgAdmin')
    expect(within(dialog()).getByRole('button', { name: /Edit/ })).toBeTruthy()
    expect(within(dialog()).queryByText(BANNER)).toBeNull()
    expect(
      within(dialog()).getByText('References Implementation. Auto-creates one task on entry.'),
    ).toBeTruthy()
  })

  it.each(['User', 'ReadOnly'] as const)(
    'gives a %s the values and the banner, and no controls',
    (role) => {
      screenAs(role)
      const d = within(dialog())
      expect(d.getByText(BANNER)).toBeTruthy()
      expect(d.getByText('References Implementation. Auto-creates one task on entry.')).toBeTruthy()
      expect(d.getByText('IMPL')).toBeTruthy()
      expect(d.queryByRole('button', { name: /Edit/ })).toBeNull()
      expect(d.queryByRole('combobox')).toBeNull()
      expect(d.queryByRole('radio')).toBeNull()
      expect(d.queryByRole('switch')).toBeNull()
      expect(d.queryByRole('button', { name: /^Remove / })).toBeNull()
      expect(d.queryByRole('button', { name: /^Move / })).toBeNull()
      expect(d.queryByRole('button', { name: /Archive/ })).toBeNull()
    },
  )

  it('shows an Org Admin no Edit on an archived board', () => {
    screenAs('OrgAdmin', { board: overview({ isArchived: true, archivedOn: '2 Sep 2026' }) })
    expect(within(dialog()).queryByRole('button', { name: /Edit/ })).toBeNull()
  })

  it('leaves the lane section out until the page has the board’s lanes', () => {
    screenAs('OrgAdmin', { view: null })
    expect(within(dialog()).queryByRole('heading', { name: 'Lanes' })).toBeNull()
  })

  it('shows another board’s lanes to nobody: a view for a different board is ignored', () => {
    screenAs('OrgAdmin', { view: { ...VIEW, boardId: 'b-other' } })
    expect(within(dialog()).queryByRole('heading', { name: 'Lanes' })).toBeNull()
  })
})

describe('the Boards drawer in edit mode', () => {
  it('gives an Org Admin the Kind, References and auto-create controls', () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    expect(d.getByRole('group', { name: 'Kind of New' })).toBeTruthy()
    expect(d.getByRole('combobox', { name: 'References board for New' })).toBeTruthy()
    expect(d.getByRole('switch', { name: 'Auto-create one task on entry' })).toBeTruthy()
    expect(d.getByRole('switch', { name: 'Idea features' })).toBeTruthy()
  })

  it('gives a User asking for edit mode only the values: the page loads no form for them', () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    screenAs('User', { form: null })
    const d = within(dialog())
    expect(d.queryByRole('combobox')).toBeNull()
    expect(d.queryByRole('switch')).toBeNull()
  })

  it('saves what was set: flags and idea features reach the action', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.click(d.getByRole('switch', { name: 'Auto-create one task on entry' }))
    fireEvent.click(
      within(d.getByRole('group', { name: 'Kind of Done' })).getByRole('radio', { name: 'Final' }),
    )
    fireEvent.click(d.getByRole('switch', { name: 'Idea features' }))
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const data = save.mock.calls[0]?.[1] as FormData
    expect(data.has('keyPrefix')).toBe(false)
    expect(data.get('ideaFeaturesEnabled')).toBe('false')
    expect(data.get('boardId')).toBe('b-1')
    expect(JSON.parse(String(data.get('laneFlags')))).toMatchObject({
      's-new': { referencesBoardId: 'b-impl', autoCreateTask: true },
      's-done': { isFinal: true },
    })
  })

  it('shows a lane refusal on its lane and nothing in the banner', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    save.mockResolvedValue({
      error: null,
      savedId: null,
      laneErrors: { 's-new': 'A Final lane can’t reference a board.' },
    })
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    const alert = await d.findByRole('alert')
    expect(alert.textContent).toBe('A Final lane can’t reference a board.')
    expect(alert.closest('li')?.textContent).toContain('New')
    expect(d.getAllByRole('alert')).toHaveLength(1)
  })

  it('shows a banner refusal as its sentence, never the bare key', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    save.mockResolvedValue({
      error:
        'A lane with ideas in it can’t have its reference changed or removed, and can’t be removed.',
      savedId: null,
    })
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    const alert = await d.findByRole('alert')
    expect(alert.textContent).toMatch(/^A lane with ideas in it/)
    expect(alert.textContent).not.toMatch(/laneInUse/)
  })

  it('creates a board with the same fields from the New board drawer', async () => {
    search.params = new URLSearchParams('board=new')
    screenAs('OrgAdmin', {
      form: { ...FORM, boardId: null, name: '', laneFlags: {} },
    })
    const d = within(dialog())
    expect(d.queryByRole('option', { name: /this board/ })).toBeNull()
    fireEvent.change(d.getByRole('textbox', { name: 'Name' }), { target: { value: 'Fresh' } })
    fireEvent.click(d.getByRole('button', { name: 'Create board' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    const data = create.mock.calls[0]?.[1] as FormData
    expect(data.has('keyPrefix')).toBe(false)
    expect(data.has('boardId')).toBe(false)
  })
})
