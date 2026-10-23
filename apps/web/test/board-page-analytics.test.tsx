import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPage from '@/app/(desk)/boards/[boardId]/page'
import { actAs } from './support/acting-role'

/** The board page mounts `board.viewed` exactly once per render (`SPEC/20-feature-analytics.md` "Events"). */
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
  viewed: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/' }))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/analytics/board-viewed', () => ({
  BoardViewed: () => {
    mocks.viewed()
    return null
  },
}))
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

function renderPage(query: Record<string, string> = {}) {
  actAs('OrgAdmin')
  return BoardPage({
    params: Promise.resolve({ boardId: 'b-1' }),
    searchParams: Promise.resolve(query),
  }).then((ui) => render(ui))
}

beforeEach(() => {
  mocks.viewed.mockReset()
  mocks.board = {
    id: 'b-1',
    name: 'Implementation',
    description: null,
    isArchived: false,
    allowUserStatusUpdate: true,
    sprintsEnabled: false,
    lanes: [{ id: 'l-1', name: 'To do', color: '#999' }],
  }
  mocks.referencedBy = [{ id: 'src', name: 'Ideas' }]
  mocks.sprints = []
  mocks.getBacklog
    .mockReset()
    .mockResolvedValue({ ideas: [], totalCount: 0, page: 1, pageSize: 100 })
  mocks.getTaskParentChoices.mockReset().mockResolvedValue([])
  mocks.getMemberOptions.mockReset().mockResolvedValue([])
  mocks.getBoardIdeaList.mockReset().mockResolvedValue({ ideas: [], totalCount: 0 })
})

describe('board page analytics', () => {
  it('mounts the board.viewed beacon once on the default tab', async () => {
    await renderPage()
    expect(mocks.viewed).toHaveBeenCalledTimes(1)
  })

  it('mounts it once on the Board tab as well', async () => {
    await renderPage({ tab: 'board' })
    expect(mocks.viewed).toHaveBeenCalledTimes(1)
  })
})
