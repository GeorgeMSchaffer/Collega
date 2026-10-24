import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPage from '@/app/(desk)/boards/[boardId]/page'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * The board page's tabs, Backlog data and role gating (TB-1, TB-2, TB-6, TB-10): which tabs a board
 * gets, which one it opens on, what the Backlog is asked for, and who is offered "+ New task" and
 * the selection boxes. The data seam is the boundary; the tab bar and header are real, and the
 * heavy children report the props they were handed.
 */
const mocks = vi.hoisted(() => ({
  board: {} as Record<string, unknown>,
  referencedBy: [] as { id: string; name: string }[],
  sprints: [] as { id: string; state: string }[],
  backlogTotal: 4,
  getBacklog: vi.fn(),
  getTaskParentChoices: vi.fn(),
  getMemberOptions: vi.fn(),
  getBoardIdeaList: vi.fn(),
  backlogProps: vi.fn(),
  drawerProps: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/' }))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/analytics/board-viewed', () => ({ BoardViewed: () => null }))
vi.mock('@/components/ideas/load-idea-drawer', () => ({
  loadIdeaDrawer: async () => ({ mode: null, idea: null, formOptions: null, missing: false }),
}))
vi.mock('@/components/ideas/idea-workspace', () => ({
  IdeaWorkspace: () => <div data-testid="board-workspace" />,
}))
vi.mock('@/components/ideas/add-idea-button', () => ({ AddIdeaButton: () => null }))
vi.mock('@/components/boards/backlog-list', () => ({
  BacklogList: (props: Record<string, unknown>) => {
    mocks.backlogProps(props)
    return <div data-testid="backlog-list" />
  },
}))
vi.mock('@/components/boards/new-task-drawer', () => ({
  NewTaskDrawer: (props: Record<string, unknown>) => {
    mocks.drawerProps(props)
    return <div data-testid="new-task-drawer" />
  },
}))
vi.mock('@/lib/data', () => ({
  getBoard: async () => mocks.board,
  getBoardIdeaList: (...args: unknown[]) => mocks.getBoardIdeaList(...args),
  getTagRefs: async () => [],
  getBoardRefs: async () => [],
  getReferenceContext: async () => ({ referencedBy: mocks.referencedBy, choices: [] }),
  getBoardSprints: async () => mocks.sprints,
  getBacklog: (...args: unknown[]) => mocks.getBacklog(...args),
  getTaskParentChoices: (...args: unknown[]) => mocks.getTaskParentChoices(...args),
  getMemberOptions: (...args: unknown[]) => mocks.getMemberOptions(...args),
}))

const WORK = [{ id: 'src', name: 'Ideas' }]

function setBoard(over: Record<string, unknown> = {}) {
  mocks.board = {
    id: 'b-1',
    name: 'Implementation',
    description: null,
    isArchived: false,
    allowUserStatusUpdate: true,
    sprintsEnabled: false,
    lanes: [{ id: 'l-1', name: 'To do', color: '#999' }],
    ...over,
  }
}

async function open(role: Role, query: Record<string, string> = {}) {
  actAs(role)
  render(
    await BoardPage({
      params: Promise.resolve({ boardId: 'b-1' }),
      searchParams: Promise.resolve(query),
    }),
  )
}

const tabNames = () =>
  screen.queryAllByRole('link').length === 0
    ? []
    : within_nav().map((link) => link.textContent?.replace(/\d+$/, ''))
const within_nav = () => [
  ...(screen.queryByRole('navigation', { name: 'Board sections' })?.querySelectorAll('a') ?? []),
]
const newTaskLinks = () => screen.queryAllByRole('link', { name: '+ New task' })

beforeEach(() => {
  setBoard()
  mocks.referencedBy = WORK
  mocks.sprints = []
  mocks.getBacklog
    .mockReset()
    .mockResolvedValue({ ideas: [], totalCount: 4, page: 1, pageSize: 100 })
  mocks.getTaskParentChoices
    .mockReset()
    .mockResolvedValue([{ id: 'p-1', itemKey: null, title: 'P' }])
  mocks.getMemberOptions.mockReset().mockResolvedValue([{ id: 'u', name: 'U' }])
  mocks.getBoardIdeaList.mockReset().mockResolvedValue({ ideas: [], totalCount: 0 })
  mocks.backlogProps.mockReset()
  mocks.drawerProps.mockReset()
})

describe('board page tabs', () => {
  it('opens a work board on its Backlog by default, with Board beside it', async () => {
    await open('OrgAdmin')
    expect(tabNames()).toEqual(['Board', 'Backlog'])
    expect(screen.getByTestId('backlog-list')).toBeTruthy()
    expect(screen.queryByTestId('board-workspace')).toBeNull()
    const backlog = screen.getByRole('link', { name: /^Backlog/ })
    expect(backlog.getAttribute('aria-current')).toBe('page')
  })

  it('opens Board when ?tab=board names it', async () => {
    await open('OrgAdmin', { tab: 'board' })
    expect(screen.getByTestId('board-workspace')).toBeTruthy()
    expect(screen.queryByTestId('backlog-list')).toBeNull()
  })

  it('opens a card deep link on the Board tab whatever the default is', async () => {
    await open('OrgAdmin', { idea: 'i-1' })
    expect(screen.getByTestId('board-workspace')).toBeTruthy()
  })

  it('shows Sprints only when the board has sprints switched on', async () => {
    setBoard({ sprintsEnabled: true })
    await open('OrgAdmin')
    expect(tabNames()).toEqual(['Board', 'Backlog', 'Sprints'])
  })

  it('refuses ?tab=sprints on a board with sprints off and falls back to the default', async () => {
    await open('OrgAdmin', { tab: 'sprints' })
    expect(screen.getByTestId('backlog-list')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Sprints' })).toBeNull()
  })

  it('shows no tab bar on a non-work board with sprints off', async () => {
    mocks.referencedBy = []
    await open('OrgAdmin')
    expect(screen.queryByRole('navigation', { name: 'Board sections' })).toBeNull()
    expect(screen.getByTestId('board-workspace')).toBeTruthy()
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })

  it('shows Board and Sprints, never Backlog, on a non-work board with sprints on', async () => {
    mocks.referencedBy = []
    setBoard({ sprintsEnabled: true })
    await open('OrgAdmin')
    expect(tabNames()).toEqual(['Board', 'Sprints'])
    expect(screen.getByTestId('board-workspace')).toBeTruthy()
  })

  it('refuses ?tab=backlog on a non-work board', async () => {
    mocks.referencedBy = []
    setBoard({ sprintsEnabled: true })
    await open('OrgAdmin', { tab: 'backlog' })
    expect(screen.queryByTestId('backlog-list')).toBeNull()
    expect(screen.getByTestId('board-workspace')).toBeTruthy()
  })

  it('badges Backlog with the API total and Sprints with the sprints not yet completed', async () => {
    setBoard({ sprintsEnabled: true })
    mocks.sprints = [
      { id: 's1', state: 'Active' },
      { id: 's2', state: 'Planned' },
      { id: 's3', state: 'Completed' },
    ]
    await open('OrgAdmin')
    expect(screen.getByRole('link', { name: /^Backlog\s*4$/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^Sprints\s*2$/ })).toBeTruthy()
  })

  it('badges Backlog from a one-row read when another tab is open', async () => {
    await open('OrgAdmin', { tab: 'board' })
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-1', 1)
    expect(screen.getByRole('link', { name: /^Backlog\s*4$/ })).toBeTruthy()
  })
})

describe('board page Backlog data', () => {
  it('reads the whole Backlog of the board on the Backlog tab', async () => {
    await open('OrgAdmin')
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-1', undefined)
    expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({
      boardId: 'b-1',
      total: 4,
    })
  })
})

describe('board page role gating', () => {
  it('Org Admin: + New task, parent choices, drawer, and selection with sprints on', async () => {
    setBoard({ sprintsEnabled: true })
    await open('OrgAdmin')
    expect(newTaskLinks().length).toBeGreaterThan(0)
    expect(screen.getByTestId('new-task-drawer')).toBeTruthy()
    expect(mocks.drawerProps.mock.calls.at(-1)?.[0]).toMatchObject({
      parents: [{ id: 'p-1', itemKey: null, title: 'P' }],
    })
    expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({
      scheduler: { isAdmin: true },
    })
  })

  it('Org Admin on a board with sprints off gets no selection', async () => {
    await open('OrgAdmin')
    expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({ scheduler: null })
  })

  it('User may add a task and select the tasks they may edit, but not create a sprint', async () => {
    setBoard({ sprintsEnabled: true })
    await open('User')
    expect(newTaskLinks().length).toBeGreaterThan(0)
    expect(screen.getByTestId('new-task-drawer')).toBeTruthy()
    expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({
      scheduler: { isAdmin: false },
    })
  })

  it.each([['ReadOnly'], ['SiteAdmin']] as const)(
    '%s sees the Backlog with no + New task, no drawer and no reads for the form',
    async (role) => {
      setBoard({ sprintsEnabled: true })
      await open(role)
      expect(screen.getByTestId('backlog-list')).toBeTruthy()
      expect(newTaskLinks()).toHaveLength(0)
      expect(screen.queryByTestId('new-task-drawer')).toBeNull()
      expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({
        scheduler: null,
        newTaskHref: null,
      })
      expect(mocks.getTaskParentChoices).not.toHaveBeenCalled()
      expect(mocks.getMemberOptions).not.toHaveBeenCalled()
    },
  )

  it('an archived board offers no + New task even to an Org Admin, and no selection', async () => {
    setBoard({ sprintsEnabled: true, isArchived: true })
    await open('OrgAdmin')
    expect(newTaskLinks()).toHaveLength(0)
    expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({
      scheduler: null,
      newTaskHref: null,
    })
  })

  it('hands the Org Admin’s Backlog the board’s sprints and the members for the create drawer', async () => {
    setBoard({ sprintsEnabled: true })
    mocks.sprints = [{ id: 's-1', state: 'Active' }]
    await open('OrgAdmin')
    expect(mocks.backlogProps.mock.calls.at(-1)?.[0]).toMatchObject({
      sprints: [{ id: 's-1', state: 'Active' }],
      members: [{ id: 'u', name: 'U' }],
      scheduler: { isAdmin: true },
    })
  })

  it('reads the members for the create drawer on the Backlog tab only', async () => {
    setBoard({ sprintsEnabled: true })
    await open('OrgAdmin', { tab: 'board' })
    expect(mocks.getMemberOptions).not.toHaveBeenCalled()
  })

  it('points + New task at the Backlog tab with the drawer parameter', async () => {
    await open('User')
    expect(newTaskLinks()[0]?.getAttribute('href')).toBe('/boards/b-1?tab=backlog&task=new')
  })

  it('reads parent choices only on the Backlog tab', async () => {
    await open('OrgAdmin', { tab: 'board' })
    expect(mocks.getTaskParentChoices).not.toHaveBeenCalled()
  })
})
