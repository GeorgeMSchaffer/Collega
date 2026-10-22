import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPage from '@/app/(desk)/boards/[boardId]/page'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'
import { backlogTask, sprint } from './support/backlog-fixtures'

/**
 * Who is handed the board's Backlog side panel (TB-7, slice 330): write roles on a sprint-enabled
 * work board's Board tab, and nobody else. The page decides; the workspace reports what it got.
 */
const mocks = vi.hoisted(() => ({
  board: {} as Record<string, unknown>,
  referencedBy: [{ id: 'src', name: 'Ideas' }] as { id: string; name: string }[],
  sprints: [] as unknown[],
  getBacklog: vi.fn(),
  workspaceProps: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/' }))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/analytics/board-viewed', () => ({ BoardViewed: () => null }))
vi.mock('@/components/ideas/load-idea-drawer', () => ({
  loadIdeaDrawer: async () => ({ mode: null, idea: null, formOptions: null, missing: false }),
}))
vi.mock('@/components/ideas/idea-workspace', () => ({
  IdeaWorkspace: (props: Record<string, unknown>) => {
    mocks.workspaceProps(props)
    return null
  },
}))
vi.mock('@/components/ideas/add-idea-button', () => ({ AddIdeaButton: () => null }))
vi.mock('@/components/boards/backlog-list', () => ({ BacklogList: () => null }))
vi.mock('@/components/boards/new-task-drawer', () => ({ NewTaskDrawer: () => null }))
vi.mock('@/lib/data', () => ({
  getBoard: async () => mocks.board,
  getBoardIdeaList: async () => ({ ideas: [], totalCount: 0 }),
  getTagRefs: async () => [],
  getBoardRefs: async () => [],
  getReferenceContext: async () => ({ referencedBy: mocks.referencedBy, choices: [] }),
  getBoardSprints: async () => mocks.sprints,
  getBacklog: (...args: unknown[]) => mocks.getBacklog(...args),
  getTaskParentChoices: async () => [],
  getMemberOptions: async () => [],
}))

function setBoard(over: Record<string, unknown> = {}) {
  mocks.board = {
    id: 'b-1',
    name: 'Implementation',
    description: null,
    isArchived: false,
    allowUserStatusUpdate: true,
    sprintsEnabled: true,
    lanes: [{ id: 'l-1', name: 'To do', color: '#999' }],
    ...over,
  }
}

async function open(role: Role, query: Record<string, string> = { tab: 'board' }) {
  actAs(role)
  render(
    await BoardPage({
      params: Promise.resolve({ boardId: 'b-1' }),
      searchParams: Promise.resolve(query),
    }),
  )
  return mocks.workspaceProps.mock.calls.at(-1)?.[0] as { backlog: unknown }
}

beforeEach(() => {
  setBoard()
  mocks.referencedBy = [{ id: 'src', name: 'Ideas' }]
  mocks.sprints = [sprint('s1', 'Active')]
  mocks.workspaceProps.mockReset()
  mocks.getBacklog.mockReset().mockResolvedValue({
    ideas: [backlogTask('1')],
    totalCount: 1,
    page: 1,
    pageSize: 100,
  })
})

describe('board page Backlog panel', () => {
  it.each([['OrgAdmin'], ['User']] as const)(
    '%s gets the panel with the whole backlog and the board’s sprints',
    async (role) => {
      const props = await open(role)
      expect(props.backlog).toMatchObject({ total: 1, sprints: [{ id: 's1' }] })
      expect(mocks.getBacklog).toHaveBeenCalledWith('b-1', undefined)
    },
  )

  it.each([['ReadOnly'], ['SiteAdmin']] as const)('%s gets no panel', async (role) => {
    expect((await open(role)).backlog).toBeNull()
  })

  it('gets no panel on an archived board', async () => {
    setBoard({ isArchived: true })
    expect((await open('OrgAdmin')).backlog).toBeNull()
  })

  it('gets no panel when sprints are off', async () => {
    setBoard({ sprintsEnabled: false })
    mocks.sprints = []
    expect((await open('OrgAdmin')).backlog).toBeNull()
  })

  it('gets no panel on a board no lane references (not a work board)', async () => {
    mocks.referencedBy = []
    expect((await open('OrgAdmin')).backlog).toBeNull()
  })

  it('reads only the badge count, and offers no panel, off the Board tab', async () => {
    const props = await open('OrgAdmin', { tab: 'sprints' })
    expect(props).toBeUndefined() // the Board workspace is not rendered at all
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-1', 1)
  })
})
