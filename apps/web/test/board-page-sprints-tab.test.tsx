import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPage from '@/app/(desk)/boards/[boardId]/page'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * The board page's Sprints tab (TB-5, TB-10): what the page reads for it and hands the list, who
 * gets canPlan, and the tab's absence on a board with sprints off.
 */
const mocks = vi.hoisted(() => ({
  board: {} as Record<string, unknown>,
  sprints: [] as Record<string, unknown>[],
  getBacklog: vi.fn(),
  getMemberOptions: vi.fn(),
  tabProps: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/' }))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/analytics/board-viewed', () => ({ BoardViewed: () => null }))
vi.mock('@/components/ideas/load-idea-drawer', () => ({
  loadIdeaDrawer: async () => ({ mode: null, idea: null, formOptions: null, missing: false }),
}))
vi.mock('@/components/ideas/idea-workspace', () => ({ IdeaWorkspace: () => null }))
vi.mock('@/components/ideas/add-idea-button', () => ({ AddIdeaButton: () => null }))
vi.mock('@/components/boards/new-task-drawer', () => ({ NewTaskDrawer: () => null }))
vi.mock('@/components/boards/backlog-list', () => ({ BacklogList: () => null }))
vi.mock('@/components/boards/sprints-tab', () => ({
  SprintsTab: (props: Record<string, unknown>) => {
    mocks.tabProps(props)
    return <div data-testid="sprints-tab" />
  },
}))
vi.mock('@/lib/data', () => ({
  getBoard: async () => mocks.board,
  getBoardIdeaList: async () => ({ ideas: [], totalCount: 0 }),
  getTagRefs: async () => [],
  getBoardRefs: async () => [],
  getReferenceContext: async () => ({ referencedBy: [{ id: 'src', name: 'Ideas' }], choices: [] }),
  getBoardSprints: async () => mocks.sprints,
  getBacklog: (...args: unknown[]) => mocks.getBacklog(...args),
  getTaskParentChoices: async () => [],
  getMemberOptions: (...args: unknown[]) => mocks.getMemberOptions(...args),
}))

async function open(role: Role, query: Record<string, string> = { tab: 'sprints' }) {
  actAs(role)
  render(
    await BoardPage({
      params: Promise.resolve({ boardId: 'b-1' }),
      searchParams: Promise.resolve(query),
    }),
  )
}
const handed = () => mocks.tabProps.mock.calls.at(-1)?.[0] as Record<string, unknown>

beforeEach(() => {
  mocks.board = {
    id: 'b-1',
    name: 'Implementation',
    description: null,
    isArchived: false,
    allowUserStatusUpdate: true,
    sprintsEnabled: true,
    lanes: [{ id: 'l-1', name: 'To do', color: '#999' }],
  }
  mocks.sprints = [{ id: 's-1', state: 'Planned' }]
  mocks.getBacklog
    .mockReset()
    .mockResolvedValue({ ideas: [{ id: 'k' }], totalCount: 9, page: 1, pageSize: 100 })
  mocks.getMemberOptions.mockReset().mockResolvedValue([{ id: 'u', name: 'U' }])
  mocks.tabProps.mockReset()
})

describe('board page Sprints tab', () => {
  it('gives an Org Admin the sprints, the full Backlog, its total, the members and canPlan', async () => {
    await open('OrgAdmin')
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-1', undefined)
    expect(handed()).toMatchObject({
      boardId: 'b-1',
      boardName: 'Implementation',
      sprints: [{ id: 's-1', state: 'Planned' }],
      waiting: 9,
      backlog: [{ id: 'k' }],
      members: [{ id: 'u', name: 'U' }],
      canPlan: true,
    })
  })

  it.each([['User'], ['ReadOnly'], ['SiteAdmin']] as const)(
    '%s gets the list and the count only: no Backlog rows, no members, no canPlan',
    async (role) => {
      await open(role)
      expect(mocks.getBacklog).toHaveBeenCalledWith('b-1', 1)
      expect(mocks.getMemberOptions).not.toHaveBeenCalled()
      expect(handed()).toMatchObject({ waiting: 9, backlog: [], members: [], canPlan: false })
    },
  )

  it('does not offer planning on an archived board', async () => {
    mocks.board = { ...mocks.board, isArchived: true }
    await open('OrgAdmin')
    expect(handed()).toMatchObject({ canPlan: false, backlog: [] })
  })

  it('shows no Sprints tab content when the board has sprints off', async () => {
    mocks.board = { ...mocks.board, sprintsEnabled: false }
    await open('OrgAdmin')
    expect(screen.queryByTestId('sprints-tab')).toBeNull()
    expect(screen.queryByRole('link', { name: /^Sprints/ })).toBeNull()
  })
})
