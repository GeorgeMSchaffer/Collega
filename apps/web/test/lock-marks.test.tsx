import { render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPage from '@/app/(desk)/boards/[boardId]/page'
import SettingsBoardsPage from '@/app/(desk)/settings/boards/page'
import { BoardCard } from '@/components/boards/board-card'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { SessionProvider } from '@/lib/session-client'
import type { BoardOverview } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * The lock a Restricted board carries (BAG-6c) on the Boards list and cards, Settings → Boards and
 * the board header, and its absence on an Organization board. The mark's accessible name is
 * "Restricted"; the data seam and the router are the boundary.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards',
  useSearchParams: () => search.params,
  notFound: vi.fn(),
}))
vi.mock('@/lib/server/board-actions', () => ({
  setBoardArchived: vi.fn(),
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/analytics/board-viewed', () => ({ BoardViewed: () => null }))
vi.mock('@/components/analytics/usage-viewed', () => ({ UsageViewed: () => null }))
vi.mock('@/components/ideas/load-idea-drawer', () => ({
  loadIdeaDrawer: async () => ({ mode: null, idea: null, formOptions: null, missing: false }),
}))
vi.mock('@/components/ideas/idea-workspace', () => ({ IdeaWorkspace: () => null }))
vi.mock('@/components/ideas/add-idea-button', () => ({ AddIdeaButton: () => null }))
vi.mock('@/components/boards/backlog-list', () => ({ BacklogList: () => null }))
vi.mock('@/components/boards/new-task-drawer', () => ({ NewTaskDrawer: () => null }))

const mocks = vi.hoisted(() => ({
  board: {} as Record<string, unknown>,
  admin: [] as { id: string; name: string; laneCount: number; restricted: boolean }[],
}))
vi.mock('@/lib/data', () => ({
  getBoard: async () => mocks.board,
  getBoardIdeaList: async () => ({ ideas: [], totalCount: 0 }),
  getTagRefs: async () => [],
  getBoardRefs: async () => [],
  getReferenceContext: async () => ({ referencedBy: [], choices: [] }),
  getBoardSprints: async () => [],
  getBacklog: async () => ({ ideas: [], totalCount: 0, page: 1, pageSize: 100 }),
  getTaskParentChoices: async () => [],
  getMemberOptions: async () => [],
  getBoardAdmin: async () => mocks.admin,
}))

function overview(name: string, restricted: boolean): BoardOverview {
  return {
    id: name.toLowerCase(),
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
    restricted,
    createdById: null,
  }
}

const OPEN = overview('Assembly', false)
const LOCKED = overview('Opportunities', true)

beforeEach(() => {
  actAs('OrgAdmin')
  search.params = new URLSearchParams()
})

/** The marks inside a container, by the accessible text the lock carries. */
const marks = (within_: HTMLElement) => within(within_).queryAllByText('Restricted')

function renderBoards() {
  const orgAdmin = {
    userId: 'u',
    displayName: 'A',
    initials: 'A',
    role: 'OrgAdmin' as const,
    roleLabel: 'Org Admin',
    organizationId: 'org-1',
    organizationName: 'Acme',
    viewingAs: null,
  }
  render(
    <SessionProvider user={orgAdmin}>
      <BoardsScreen boards={[OPEN, LOCKED]} adminDenial={null} createDenial={null} form={null} />
    </SessionProvider>,
  )
}

describe('the Boards list', () => {
  it('marks a Restricted board and no other', () => {
    renderBoards()
    const table = screen.getByRole('table', { name: 'Boards' })
    expect(marks(within(table).getByRole('row', { name: /Opportunities/ }))).toHaveLength(1)
    expect(marks(within(table).getByRole('row', { name: /Assembly/ }))).toHaveLength(0)
  })

  it('marks the card of a Restricted board and no other', () => {
    const { container } = render(
      <>
        <BoardCard board={LOCKED} actions={null} />
        <BoardCard board={OPEN} actions={null} />
      </>,
    )
    const [locked, open] = Array.from(container.querySelectorAll<HTMLElement>('h2'))
    expect(marks(locked as HTMLElement)).toHaveLength(1)
    expect(marks(open as HTMLElement)).toHaveLength(0)
  })

  it('marks the cards in the Cards view of the screen', () => {
    search.params = new URLSearchParams('view=cards')
    renderBoards()
    expect(screen.getAllByRole('heading', { level: 2, name: /Opportunities/ })).toHaveLength(1)
    expect(screen.getAllByText('Restricted')).toHaveLength(1)
  })
})

describe('Settings → Boards', () => {
  it('marks a Restricted board and no other', async () => {
    mocks.admin = [
      { id: 'a', name: 'Assembly', laneCount: 2, restricted: false },
      { id: 'o', name: 'Opportunities', laneCount: 2, restricted: true },
    ]
    render((await SettingsBoardsPage()) as ReactElement)
    expect(marks(screen.getByText('Opportunities').closest('tr') as HTMLElement)).toHaveLength(1)
    expect(marks(screen.getByText('Assembly').closest('tr') as HTMLElement)).toHaveLength(0)
  })
})

describe('the board header', () => {
  async function header(restricted: boolean) {
    mocks.board = {
      id: 'b-1',
      name: 'Opportunities',
      description: null,
      isArchived: false,
      allowUserStatusUpdate: true,
      sprintsEnabled: false,
      restricted,
      lanes: [{ id: 'l-1', name: 'To do', color: '#999' }],
    }
    render(
      await BoardPage({
        params: Promise.resolve({ boardId: 'b-1' }),
        searchParams: Promise.resolve({}),
      }),
    )
    return screen.getByRole('heading', { level: 1 })
  }

  it('carries the lock beside the name of a Restricted board', async () => {
    expect(marks(await header(true))).toHaveLength(1)
  })

  it('carries none on an Organization board', async () => {
    expect(marks(await header(false))).toHaveLength(0)
  })
})
