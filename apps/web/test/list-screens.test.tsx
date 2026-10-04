import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { boardAdminDenial, boardCreateDenial, type Role } from '@/lib/roles'
import { SessionProvider } from '@/lib/session-client'
import type { BoardOverview, BoardRef, CurrentUser, Idea } from '@/lib/types'

/**
 * What each list screen's rows let a role do (comp R row actions): Edit and the destructive action
 * are hidden, not disabled, where the role or an archived board forbids them — the Denied rule's
 * row-action exception (`SPEC/20-feature-client-ui.md`). And the Boards list's default order.
 *
 * The server actions and the router are the boundary and are replaced.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/ideas',
  useSearchParams: () => search.params,
}))
vi.mock('@/lib/server/idea-actions', () => ({
  deleteIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  moveIdea: vi.fn(),
}))
vi.mock('@/lib/server/board-actions', () => ({
  setBoardArchived: vi.fn(),
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))

beforeEach(() => {
  search.params = new URLSearchParams()
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

const BOARD_REFS: BoardRef[] = [
  { id: 'open', name: 'Assembly', isArchived: false },
  { id: 'shut', name: 'Old plant', isArchived: true },
]

function ideaOn(boardId: string, title: string): Idea {
  return {
    id: `idea-${boardId}`,
    boardId,
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

function renderIdeas(role: Role) {
  render(
    as(
      role,
      <IdeaWorkspace
        rows={[ideaOn('open', 'Live idea'), ideaOn('shut', 'Frozen idea')]}
        total={2}
        boards={BOARD_REFS}
        statuses={[{ id: 's1', name: 'New', color: '#999' }]}
        tags={[]}
        board={null}
        drawer={{ mode: null, idea: null, formOptions: null }}
      />,
    ),
  )
}

const action = (name: string) => screen.queryByRole('button', { name })

describe('Ideas row actions', () => {
  const EXPECTED: Record<Role, { edit: boolean; remove: boolean }> = {
    OrgAdmin: { edit: true, remove: true },
    User: { edit: true, remove: false },
    ReadOnly: { edit: false, remove: false },
    SiteAdmin: { edit: false, remove: false },
  }

  for (const [role, expected] of Object.entries(EXPECTED) as [Role, (typeof EXPECTED)[Role]][]) {
    it(`gives ${role} View${expected.edit ? ', Edit' : ''}${expected.remove ? ', Delete' : ''} on a live board`, () => {
      renderIdeas(role)
      expect(action('View Live idea')).not.toBeNull()
      expect(action('Edit Live idea') !== null).toBe(expected.edit)
      expect(action('Delete Live idea') !== null).toBe(expected.remove)
    })

    it(`gives ${role} only View on an archived board`, () => {
      renderIdeas(role)
      expect(action('View Frozen idea')).not.toBeNull()
      expect(action('Edit Frozen idea')).toBeNull()
      expect(action('Delete Frozen idea')).toBeNull()
    })
  }

  it('hides rather than disables: no denied Edit or Delete is left in the row', () => {
    renderIdeas('ReadOnly')
    const row = screen.getByRole('row', { name: /Live idea/ })
    expect(
      within(row)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([null, 'View Live idea'])
  })
})

function boardOverview(name: string, overrides: Partial<BoardOverview> = {}): BoardOverview {
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
    ...overrides,
  }
}

function renderBoards(role: Role, boards: BoardOverview[]) {
  render(
    as(
      role,
      <BoardsScreen
        boards={boards}
        adminDenial={boardAdminDenial(role)}
        createDenial={boardCreateDenial(role)}
        form={null}
      />,
    ),
  )
}

const boardNamesInOrder = () =>
  within(screen.getByRole('table', { name: 'Boards' }))
    .getAllByRole('link')
    .map((link) => link.textContent)

describe('Boards screen', () => {
  it('lists boards by name, ascending, when no sort is chosen', () => {
    renderBoards('OrgAdmin', [
      boardOverview('Paint shop', { createdAtUtc: '2026-09-01T00:00:00.000Z' }),
      boardOverview('assembly', { createdAtUtc: '2026-09-03T00:00:00.000Z' }),
      boardOverview('Machining 10', { createdAtUtc: '2026-09-02T00:00:00.000Z' }),
      boardOverview('Machining 9', { createdAtUtc: '2026-09-04T00:00:00.000Z' }),
    ])
    expect(boardNamesInOrder()).toEqual(['assembly', 'Machining 9', 'Machining 10', 'Paint shop'])
  })

  it('pages at 10 by default, so the eleventh board by name is on page 2', () => {
    const names = Array.from({ length: 11 }, (_, i) => `Board ${String(i + 1).padStart(2, '0')}`)
    renderBoards('OrgAdmin', names.map((name) => boardOverview(name)).reverse())
    expect(boardNamesInOrder()).toEqual(names.slice(0, 10))
  })

  it('shows only active boards until the Status filter says otherwise', () => {
    renderBoards('OrgAdmin', [
      boardOverview('Assembly'),
      boardOverview('Old plant', { isArchived: true, archivedOn: '2 Sep 2026' }),
    ])
    expect(boardNamesInOrder()).toEqual(['Assembly'])
  })

  it('gives an Org Admin View, Edit and Archive', () => {
    renderBoards('OrgAdmin', [boardOverview('Assembly')])
    expect(action('View Assembly')).not.toBeNull()
    expect(action('Edit Assembly')).not.toBeNull()
    expect(action('Archive Assembly')).not.toBeNull()
  })

  it('gives an Org Admin Unarchive but no Edit on an archived board', () => {
    search.params = new URLSearchParams('status=Archived')
    renderBoards('OrgAdmin', [boardOverview('Old plant', { isArchived: true })])
    expect(action('View Old plant')).not.toBeNull()
    expect(action('Edit Old plant')).toBeNull()
    expect(action('Unarchive Old plant')).not.toBeNull()
  })

  for (const role of ['User', 'ReadOnly', 'SiteAdmin'] as const) {
    it(`hides Edit and Archive from ${role}`, () => {
      renderBoards(role, [boardOverview('Assembly')])
      expect(action('View Assembly')).not.toBeNull()
      expect(action('Edit Assembly')).toBeNull()
      expect(action('Archive Assembly')).toBeNull()
    })

    it(`hides Unarchive from ${role}`, () => {
      search.params = new URLSearchParams('status=Archived')
      renderBoards(role, [boardOverview('Old plant', { isArchived: true })])
      expect(action('Unarchive Old plant')).toBeNull()
    })
  }
})
