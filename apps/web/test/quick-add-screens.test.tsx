import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { BacklogScreen } from '@/components/delivery/backlog-screen'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { boardAdminDenial, boardCreateDenial, type Role, writeDenial } from '@/lib/roles'
import { SessionProvider } from '@/lib/session-client'
import type { BoardOverview, CurrentUser, Idea, IdeaFormOptions, Issue, Sprint } from '@/lib/types'
import { stubDialogMethods } from './support/dialog'

/**
 * How the three list screens adopt the quick-add bar: what each asks for, what it hands the create
 * drawer, who sees it, and (Boards) what it saves. With one row or fewer the bar is absent and the page's own
 * Add New button remains. The server actions and the router are the
 * boundary and are replaced.
 */
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/list',
  useSearchParams: () => nav.params,
}))
const quickAddBoard = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/board-actions', () => ({
  quickAddBoard,
  setBoardArchived: vi.fn(),
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
  reorderLanes: vi.fn(),
}))
vi.mock('@/lib/server/idea-actions', () => ({
  deleteIdea: vi.fn(),
  detachIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  moveIdea: vi.fn(),
}))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue: vi.fn() }))

stubDialogMethods()

beforeEach(() => {
  nav.params = new URLSearchParams()
  nav.push.mockReset()
  quickAddBoard.mockReset()
  Element.prototype.scrollIntoView = vi.fn()
})

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
const as = (role: Role, children: ReactNode) => (
  <SessionProvider user={user(role)}>{children}</SessionProvider>
)

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const enter = (el: HTMLElement) => fireEvent.keyDown(el, { key: 'Enter' })
/** The create drawer is an `aside`; its form exists only while the page has supplied the catalogs. */
const drawerForm = () => document.querySelector('aside form') as HTMLElement
const bar = (testId: string) => screen.queryByTestId(testId)
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}

/* ------------------------------------------------------------------ Backlog */

const SPRINTS: Pick<Sprint, 'id' | 'name' | 'state'>[] = [
  { id: 'sp-1', name: 'Sprint 14', state: 'Active' },
  { id: 'sp-2', name: 'Sprint 15', state: 'Planned' },
]

function issue(id: string, title: string): Issue {
  return {
    id,
    title,
    deliveryStatusId: 'ds-1',
    sprintId: null,
    outcomeId: null,
    effort: 'Low',
    assigneeInitials: null,
    upvotesAtPromotion: 1,
    boardId: null,
    authorUserId: 'u',
    assignees: [],
    tags: [],
    sprint: null,
    upvotes: 1,
    taskSummary: { done: 0, total: 0 },
    promotedOn: null,
    promotedBy: null,
  }
}

function backlog(
  props: Partial<React.ComponentProps<typeof BacklogScreen>> = {},
  role: Role = 'User',
) {
  return as(
    role,
    <BacklogScreen
      rows={[issue('i1', 'Existing issue')]}
      outcomes={[]}
      statuses={[{ id: 'ds-1', name: 'Open' }]}
      sprints={SPRINTS}
      editableIds={[]}
      canAdd
      selectedId={null}
      options={null}
      empty={<p>Nothing waiting</p>}
      {...props}
    />,
  )
}

const TWO_ISSUES = [issue('i1', 'Existing issue'), issue('i2', 'Another issue')]

describe('Backlog quick-add bar', () => {
  it('asks for a Title only; Effort and Sprint come from the drawer', () => {
    render(backlog({ rows: TWO_ISSUES }))
    expect(bar('backlog-quick-add-bar')).not.toBeNull()
    expect(
      within(bar('backlog-quick-add-bar') as HTMLElement).getAllByRole('textbox'),
    ).toHaveLength(1)
  })

  it('is hidden when the role may not add', () => {
    render(backlog({ rows: TWO_ISSUES, canAdd: false }, 'ReadOnly'))
    expect(bar('backlog-quick-add-bar')).toBeNull()
    expect(screen.getByText('Existing issue')).toBeTruthy()
  })

  it('is absent with one issue (the header button remains)', () => {
    render(backlog())
    expect(bar('backlog-quick-add-bar')).toBeNull()
  })

  it('is replaced by the empty state when the backlog has no issues', () => {
    render(backlog({ rows: [] }))
    expect(screen.getByText('Nothing waiting')).toBeTruthy()
    expect(bar('backlog-quick-add-bar')).toBeNull()
  })

  it('never creates: Enter opens the create drawer via ?new=1 and clears the bar', () => {
    render(backlog({ rows: TWO_ISSUES }))
    const title = field('Quick add issue')
    type(title, '  Replace belt  ')
    enter(title)
    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/list?new=1', { scroll: false })
    expect(title.value).toBe('')
  })

  it('refuses an empty Title without opening the drawer', () => {
    render(backlog({ rows: TWO_ISSUES }))
    enter(field('Quick add issue'))
    expect(nav.push).not.toHaveBeenCalled()
    expect(screen.getByText('Enter title.')).toBeTruthy()
  })

  it('hands the Title to the create form as its starting value', () => {
    const view = render(backlog({ rows: TWO_ISSUES }))
    type(field('Quick add issue'), 'Replace belt')
    enter(field('Quick add issue'))

    // The page re-reads on ?new=1 and passes the catalogs, which opens the drawer.
    view.rerender(backlog({ rows: TWO_ISSUES, options: OPTIONS }))
    const dialog = drawerForm()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('Replace belt')
    expect(dialog.querySelector('input[type="radio"]:checked')).toBeNull()
  })

  it('starts the form empty when it is opened without the bar (header button)', () => {
    render(backlog({ options: OPTIONS }))
    const dialog = drawerForm()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('')
    expect(dialog.querySelector('input[type="radio"]:checked')).toBeNull()
    expect((within(dialog).getByLabelText(/^Sprint/) as HTMLSelectElement).value).toBe('')
  })
})

/* ------------------------------------------------------------------- Ideas */

function idea(id: string, title: string): Idea {
  return {
    id,
    boardId: 'open',
    authorUserId: null,
    statusId: 's1',
    statusName: 'New',
    title,
    priority: 'Medium',
    ideaType: 'Continuous Improvement',
    businessImpact: 'Medium',
    tag: null,
    tags: [],
    assigneeInitials: null,
    assignees: [],
    upvotes: 0,
    hasUpvoted: false,
    effort: null,
    itemKey: null,
    parentIdeaId: null,
    taskCounts: null,
    blockedBy: [],
  }
}

function ideas(role: Role, props: Partial<React.ComponentProps<typeof IdeaWorkspace>> = {}) {
  return as(
    role,
    <IdeaWorkspace
      rows={[idea('x1', 'Live idea')]}
      total={1}
      boards={[
        { id: 'open', name: 'Assembly', isArchived: false },
        { id: 'shut', name: 'Old plant', isArchived: true },
      ]}
      statuses={[{ id: 's1', name: 'New', color: '#999' }]}
      tags={[]}
      board={null}
      drawer={{ mode: null, idea: null, formOptions: null }}
      {...props}
    />,
  )
}

const boardContext = (isArchived: boolean) => ({
  id: isArchived ? 'shut' : 'open',
  name: isArchived ? 'Old plant' : 'Assembly',
  lanes: [{ id: 's1', name: 'New', color: '#999' }],
  isArchived,
  canMove: false,
  canReorder: false,
})

const TWO_IDEAS = [idea('x1', 'Live idea'), idea('x2', 'Second idea')]

describe('Ideas quick-add bar', () => {
  it('asks for a Title only', () => {
    render(ideas('User', { rows: TWO_IDEAS, total: 2 }))
    const quick = bar('ideas-quick-add-bar') as HTMLElement
    expect(within(quick).getAllByRole('textbox')).toHaveLength(1)
    expect(within(quick).queryAllByRole('combobox')).toHaveLength(0)
  })

  it.each([
    ['OrgAdmin', true],
    ['User', true],
    ['ReadOnly', false],
    ['SiteAdmin', false],
  ] as const)('shows it for %s: %s', (role, shown) => {
    expect(writeDenial(role) === null).toBe(shown)
    render(ideas(role, { rows: TWO_IDEAS, total: 2 }))
    expect(bar('ideas-quick-add-bar') !== null).toBe(shown)
  })

  it('is absent with one idea or none (the header button remains)', () => {
    render(ideas('User'))
    expect(bar('ideas-quick-add-bar')).toBeNull()
  })

  it('is hidden on an archived board’s List view', () => {
    nav.params = new URLSearchParams('view=list')
    render(ideas('OrgAdmin', { rows: TWO_IDEAS, total: 2, board: boardContext(true) }))
    expect(bar('ideas-quick-add-bar')).toBeNull()
  })

  it('is shown on a live board’s List view and absent from its Lanes view', () => {
    nav.params = new URLSearchParams('view=list')
    const view = render(
      ideas('OrgAdmin', { rows: TWO_IDEAS, total: 2, board: boardContext(false) }),
    )
    expect(bar('ideas-quick-add-bar')).not.toBeNull()
    view.unmount()
    nav.params = new URLSearchParams()
    render(ideas('OrgAdmin', { rows: TWO_IDEAS, total: 2, board: boardContext(false) }))
    expect(bar('ideas-quick-add-bar')).toBeNull()
  })

  it('refuses an empty Title without opening the drawer', () => {
    render(ideas('User', { rows: TWO_IDEAS, total: 2 }))
    enter(field('Quick add idea'))
    expect(nav.push).not.toHaveBeenCalled()
    expect(screen.getByText('Enter title.')).toBeTruthy()
  })

  it('opens the create drawer with the Title and clears the bar', () => {
    const props = { rows: TWO_IDEAS, total: 2 }
    const view = render(ideas('User', props))
    const title = field('Quick add idea')
    type(title, ' Fewer changeovers ')
    enter(title)
    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/list?new=1', { scroll: false })
    expect(title.value).toBe('')

    view.rerender(
      ideas('User', { ...props, drawer: { mode: 'create', idea: null, formOptions: OPTIONS } }),
    )
    const dialog = drawerForm()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Fewer changeovers',
    )
  })

  it('does not carry the Title into a drawer opened later without the bar', () => {
    const props = { rows: TWO_IDEAS, total: 2 }
    const open = { drawer: { mode: 'create' as const, idea: null, formOptions: OPTIONS } }
    const view = render(ideas('User', props))
    type(field('Quick add idea'), 'Spent title')
    enter(field('Quick add idea'))
    view.rerender(ideas('User', { ...props, ...open }))
    // The form has read it; closing and reopening from the header button starts empty.
    view.rerender(ideas('User', props))
    view.rerender(ideas('User', { ...props, ...open }))
    const dialog = drawerForm()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('')
  })
})

/* ------------------------------------------------------------------ Boards */

function overview(name: string): BoardOverview {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    description: null,
    ideaCount: 0,
    laneCount: 0,
    createdAtUtc: '2026-09-01T00:00:00.000Z',
    createdOn: '1 Sep 2026',
    createdBy: null,
    lanes: [],
    topTags: [],
    tagCount: 0,
    userStatusMoves: false,
    isArchived: false,
    archivedOn: null,
    keyPrefix: null,
    sprintsEnabled: false,
    ideaFeaturesEnabled: true,
  }
}

function boards(role: Role, props: Partial<React.ComponentProps<typeof BoardsScreen>> = {}) {
  return as(
    role,
    <BoardsScreen
      boards={[overview('Assembly')]}
      adminDenial={boardAdminDenial(role)}
      createDenial={boardCreateDenial(role)}
      form={null}
      quickAddLaneIds={['st-1', 'st-2']}
      {...props}
    />,
  )
}

const TWO_BOARDS = [overview('Assembly'), overview('Paint')]

describe('Boards quick-add bar', () => {
  it('asks for a board name only', () => {
    render(boards('OrgAdmin', { boards: TWO_BOARDS }))
    const quick = bar('boards-quick-add-bar') as HTMLElement
    expect(within(quick).getAllByRole('textbox')).toHaveLength(1)
    expect(field('Quick add board')).toBeTruthy()
  })

  it.each([
    ['OrgAdmin', true],
    ['User', true],
    ['ReadOnly', false],
    ['SiteAdmin', false],
  ] as const)('shows it for %s: %s', (role, shown) => {
    render(boards(role, { boards: TWO_BOARDS }))
    expect(bar('boards-quick-add-bar') !== null).toBe(shown)
  })

  it('is absent with one board or none (the header button remains)', () => {
    render(boards('OrgAdmin'))
    expect(bar('boards-quick-add-bar')).toBeNull()
  })

  it('is hidden when the catalog has fewer than two statuses to use as lanes', () => {
    render(boards('OrgAdmin', { boards: TWO_BOARDS, quickAddLaneIds: ['st-1'] }))
    expect(bar('boards-quick-add-bar')).toBeNull()
  })

  it('is hidden when the page supplied no lanes', () => {
    render(boards('OrgAdmin', { boards: TWO_BOARDS, quickAddLaneIds: [] }))
    expect(bar('boards-quick-add-bar')).toBeNull()
  })

  it('shows the first-run empty state, with no table, when there are no boards and no way to add', () => {
    render(boards('ReadOnly', { boards: [] }))
    expect(screen.getByText('No boards yet')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows the empty message when there are no boards but adding is allowed', () => {
    render(boards('OrgAdmin', { boards: [] }))
    expect(screen.queryByText('No boards yet')).toBeNull()
    expect(screen.getByText(/A new organization starts with one default board/)).toBeTruthy()
  })

  it('creates directly: the trimmed name goes to quickAddBoard with the page’s lane ids', async () => {
    quickAddBoard.mockResolvedValue({ ok: true, boardId: 'b-new' })
    render(boards('OrgAdmin', { boards: TWO_BOARDS }))
    const name = field('Quick add board')
    type(name, '  Paint shop  ')
    await act(async () => enter(name))
    expect(quickAddBoard).toHaveBeenCalledExactlyOnceWith('Paint shop', ['st-1', 'st-2'])
    expect(nav.push).not.toHaveBeenCalled()
    expect(name.value).toBe('')
    expect(screen.getByRole('status').textContent).toBe('Board added')
  })

  it('refuses an empty name without calling the action', async () => {
    render(boards('OrgAdmin', { boards: TWO_BOARDS }))
    await act(async () => enter(field('Quick add board')))
    expect(quickAddBoard).not.toHaveBeenCalled()
    expect(screen.getByText('Enter board name.')).toBeTruthy()
  })

  it('marks the name when the server refuses it, and keeps what was typed', async () => {
    quickAddBoard.mockResolvedValue({
      ok: false,
      error: null,
      errors: { name: 'A board with this name already exists.' },
    })
    render(boards('OrgAdmin', { boards: TWO_BOARDS }))
    const name = field('Quick add board')
    type(name, 'Assembly')
    await act(async () => enter(name))
    expect(screen.getByText('A board with this name already exists.')).toBeTruthy()
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(name.value).toBe('Assembly')
  })

  it('shows a refusal with no field as an alert on the bar', async () => {
    quickAddBoard.mockResolvedValue({ ok: false, error: 'Archived.', errors: {} })
    render(boards('OrgAdmin', { boards: TWO_BOARDS }))
    const name = field('Quick add board')
    type(name, 'Assembly')
    await act(async () => enter(name))
    expect(within(bar('boards-quick-add-bar') as HTMLElement).getByRole('alert').textContent).toBe(
      'Archived.',
    )
  })
})
