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
 * How the three list screens adopt the quick-add row: which fields each asks for, what it hands the
 * create drawer, who sees it, and (Boards) what it saves. The server actions and the router are the
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
const row = (name: string) => screen.queryByRole('row', { name })

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

describe('Backlog quick-add row', () => {
  it('asks for Title, Effort and Sprint, with Sprint listing Backlog first then the open sprints', () => {
    render(backlog())
    const quick = row('Quick add issue') as HTMLElement
    expect(within(quick).getByLabelText('Title')).toBeTruthy()
    const effort = within(quick).getByLabelText('Effort') as HTMLSelectElement
    expect([...effort.options].map((o) => o.text)).toEqual([
      'Choose effort',
      'Low',
      'Medium',
      'High',
    ])
    const sprint = within(quick).getByLabelText('Sprint') as HTMLSelectElement
    expect([...sprint.options].map((o) => o.text)).toEqual(['Backlog', 'Sprint 14', 'Sprint 15'])
    expect(sprint.value).toBe('')
  })

  it('is the first body row, above the issues', () => {
    render(backlog())
    const rows = within(screen.getAllByRole('rowgroup')[1] as HTMLElement).getAllByRole('row')
    expect(rows[0]?.getAttribute('aria-label')).toBe('Quick add issue')
    expect(rows[1]?.getAttribute('data-row-key')).toBe('i1')
  })

  it('is hidden when the role may not add', () => {
    render(backlog({ canAdd: false }, 'ReadOnly'))
    expect(row('Quick add issue')).toBeNull()
    expect(screen.getByText('Existing issue')).toBeTruthy()
  })

  it('is replaced by the empty state when the backlog has no issues', () => {
    render(backlog({ rows: [] }))
    expect(screen.getByText('Nothing waiting')).toBeTruthy()
    expect(row('Quick add issue')).toBeNull()
  })

  it('never creates: Enter opens the create drawer via ?new=1 and clears the row', () => {
    render(backlog())
    const quick = row('Quick add issue') as HTMLElement
    type(within(quick).getByLabelText('Title'), '  Replace belt  ')
    type(within(quick).getByLabelText('Effort'), 'High')
    type(within(quick).getByLabelText('Sprint'), 'sp-2')
    enter(within(quick).getByLabelText('Title'))
    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/list?new=1', { scroll: false })
    expect((within(quick).getByLabelText('Title') as HTMLInputElement).value).toBe('')
  })

  it('refuses without opening the drawer when Effort is not chosen', () => {
    render(backlog())
    const quick = row('Quick add issue') as HTMLElement
    type(within(quick).getByLabelText('Title'), 'Replace belt')
    enter(within(quick).getByLabelText('Title'))
    expect(nav.push).not.toHaveBeenCalled()
    expect(within(quick).getByText('Choose effort.')).toBeTruthy()
  })

  it('hands Title, Effort and Sprint to the create form as its starting values', () => {
    const view = render(backlog())
    const quick = row('Quick add issue') as HTMLElement
    type(within(quick).getByLabelText('Title'), 'Replace belt')
    type(within(quick).getByLabelText('Effort'), 'High')
    type(within(quick).getByLabelText('Sprint'), 'sp-2')
    enter(within(quick).getByLabelText('Title'))

    // The page re-reads on ?new=1 and passes the catalogs, which opens the drawer.
    view.rerender(backlog({ options: OPTIONS }))
    const dialog = drawerForm()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('Replace belt')
    const checked = dialog.querySelector<HTMLInputElement>('input[type="radio"]:checked')
    expect(checked?.value).toBe('High')
    expect((within(dialog).getByLabelText(/^Sprint/) as HTMLSelectElement).value).toBe('sp-2')
  })

  it('starts the form empty when it is opened without the row (header button)', () => {
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

describe('Ideas quick-add row', () => {
  it('asks for a Title only', () => {
    render(ideas('User'))
    const quick = row('Quick add idea') as HTMLElement
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
    render(ideas(role))
    expect(row('Quick add idea') !== null).toBe(shown)
  })

  it('shows it above an empty list, beside the empty message', () => {
    render(ideas('User', { rows: [], total: 0 }))
    expect(row('Quick add idea')).not.toBeNull()
  })

  it('is hidden on an archived board’s List view', () => {
    nav.params = new URLSearchParams('view=list')
    render(ideas('OrgAdmin', { board: boardContext(true) }))
    expect(row('Quick add idea')).toBeNull()
  })

  it('is shown on a live board’s List view and absent from its Lanes view', () => {
    nav.params = new URLSearchParams('view=list')
    const view = render(ideas('OrgAdmin', { board: boardContext(false) }))
    expect(row('Quick add idea')).not.toBeNull()
    view.unmount()
    nav.params = new URLSearchParams()
    render(ideas('OrgAdmin', { board: boardContext(false) }))
    expect(row('Quick add idea')).toBeNull()
  })

  it('refuses an empty Title without opening the drawer', () => {
    render(ideas('User'))
    const quick = row('Quick add idea') as HTMLElement
    enter(within(quick).getByLabelText('Title'))
    expect(nav.push).not.toHaveBeenCalled()
    expect(within(quick).getByText('Enter title.')).toBeTruthy()
  })

  it('opens the create drawer with the Title and clears the row', () => {
    const view = render(ideas('User'))
    const quick = row('Quick add idea') as HTMLElement
    const field = within(quick).getByLabelText('Title') as HTMLInputElement
    type(field, ' Fewer changeovers ')
    enter(field)
    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/list?new=1', { scroll: false })
    expect(field.value).toBe('')

    view.rerender(ideas('User', { drawer: { mode: 'create', idea: null, formOptions: OPTIONS } }))
    const dialog = drawerForm()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Fewer changeovers',
    )
  })

  it('does not carry the Title into a drawer opened later without the row', () => {
    const view = render(ideas('User'))
    const quick = row('Quick add idea') as HTMLElement
    type(within(quick).getByLabelText('Title'), 'Spent title')
    enter(within(quick).getByLabelText('Title'))
    view.rerender(ideas('User', { drawer: { mode: 'create', idea: null, formOptions: OPTIONS } }))
    // The form has read it; closing and reopening from the header button starts empty.
    view.rerender(ideas('User'))
    view.rerender(ideas('User', { drawer: { mode: 'create', idea: null, formOptions: OPTIONS } }))
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

describe('Boards quick-add row', () => {
  it('asks for a board name only', () => {
    render(boards('OrgAdmin'))
    const quick = row('Quick add board') as HTMLElement
    expect(within(quick).getAllByRole('textbox')).toHaveLength(1)
    expect(within(quick).getByLabelText('Board name')).toBeTruthy()
  })

  it.each([
    ['OrgAdmin', true],
    ['User', true],
    ['ReadOnly', false],
    ['SiteAdmin', false],
  ] as const)('shows it for %s: %s', (role, shown) => {
    render(boards(role))
    expect(row('Quick add board') !== null).toBe(shown)
  })

  it('is hidden when the catalog has fewer than two statuses to use as lanes', () => {
    render(boards('OrgAdmin', { quickAddLaneIds: ['st-1'] }))
    expect(row('Quick add board')).toBeNull()
  })

  it('is hidden when the page supplied no lanes', () => {
    render(boards('OrgAdmin', { quickAddLaneIds: [] }))
    expect(row('Quick add board')).toBeNull()
  })

  it('shows the first-run empty state, with no table, when there are no boards and no row', () => {
    render(boards('ReadOnly', { boards: [] }))
    expect(screen.getByText('No boards yet')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows the row above the empty message when there are no boards but the row is allowed', () => {
    render(boards('OrgAdmin', { boards: [] }))
    expect(row('Quick add board')).not.toBeNull()
    expect(screen.queryByText('No boards yet')).toBeNull()
    expect(screen.getByText(/A new organization starts with one default board/)).toBeTruthy()
  })

  it('creates directly: the trimmed name goes to quickAddBoard with the page’s lane ids', async () => {
    quickAddBoard.mockResolvedValue({ ok: true, boardId: 'b-new' })
    render(boards('OrgAdmin'))
    const field = within(row('Quick add board') as HTMLElement).getByLabelText('Board name')
    type(field, '  Paint shop  ')
    await act(async () => enter(field))
    expect(quickAddBoard).toHaveBeenCalledExactlyOnceWith('Paint shop', ['st-1', 'st-2'])
    expect(nav.push).not.toHaveBeenCalled()
    expect((field as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('status').textContent).toBe('Board added')
  })

  it('refuses an empty name without calling the action', async () => {
    render(boards('OrgAdmin'))
    const field = within(row('Quick add board') as HTMLElement).getByLabelText('Board name')
    await act(async () => enter(field))
    expect(quickAddBoard).not.toHaveBeenCalled()
    expect(screen.getByText('Enter board name.')).toBeTruthy()
  })

  it('marks the name when the server refuses it, and keeps what was typed', async () => {
    quickAddBoard.mockResolvedValue({
      ok: false,
      error: null,
      errors: { name: 'A board with this name already exists.' },
    })
    render(boards('OrgAdmin'))
    const field = within(row('Quick add board') as HTMLElement).getByLabelText(
      'Board name',
    ) as HTMLInputElement
    type(field, 'Assembly')
    await act(async () => enter(field))
    expect(screen.getByText('A board with this name already exists.')).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.value).toBe('Assembly')
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows a refusal with no field as an alert on the row', async () => {
    quickAddBoard.mockResolvedValue({ ok: false, error: 'Archived.', errors: {} })
    render(boards('OrgAdmin'))
    const field = within(row('Quick add board') as HTMLElement).getByLabelText('Board name')
    type(field, 'Assembly')
    await act(async () => enter(field))
    expect(within(row('Quick add board') as HTMLElement).getByRole('alert').textContent).toBe(
      'Archived.',
    )
  })
})
