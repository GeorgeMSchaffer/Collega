import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import type { Role } from '@/lib/roles'
import { SessionProvider } from '@/lib/session-client'
import type { BoardRef, CurrentUser, Idea, IdeaFormOptions } from '@/lib/types'

/**
 * Where the pull-in slice shows up on the idea screens (`20-feature-board-pull-in.md` rules 5-7):
 * the *No board* label on a pool idea, who is offered Remove from board on a row (and which rows
 * show it disabled with a reason), and the create form's Board default by entry point - empty from
 * the Ideas list, the board's own when opened from that board's page.
 *
 * The server actions and the router are the boundary and are replaced.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/ideas',
  useSearchParams: () => new URLSearchParams(),
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

const ME = 'user-me'

function user(role: Role): CurrentUser {
  return {
    userId: ME,
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

const BOARDS: BoardRef[] = [
  { id: 'open', name: 'Assembly', isArchived: false, hasReferenceLane: false },
  { id: 'shut', name: 'Old plant', isArchived: true, hasReferenceLane: false },
]

function idea(id: string, boardId: string | null, authorUserId: string | null = ME): Idea {
  return {
    id,
    boardId,
    authorUserId,
    statusId: 's1',
    statusName: 'New',
    title: id,
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

const ROWS = [
  idea('mine-live', 'open'),
  idea('theirs-live', 'open', 'someone-else'),
  idea('mine-pool', null),
  idea('mine-issue', 'open'),
  idea('mine-archived', 'shut'),
]

const FORM_OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}

function renderIdeas(role: Role, extra: Partial<React.ComponentProps<typeof IdeaWorkspace>> = {}) {
  render(
    as(
      role,
      <IdeaWorkspace
        rows={ROWS}
        total={ROWS.length}
        boards={BOARDS}
        statuses={[{ id: 's1', name: 'New', color: '#999' }]}
        tags={[]}
        board={null}
        issueIds={['mine-issue']}
        drawer={{ mode: null, idea: null, formOptions: null }}
        {...extra}
      />,
    ),
  )
}

const detach = (title: string) =>
  screen.queryByRole('button', { name: `Remove from board: ${title}` })
const rowOf = (title: string) => screen.getByRole('row', { name: new RegExp(title) })

beforeEach(() => vi.clearAllMocks())

describe('Ideas list: the pool', () => {
  it('labels a pool idea No board in the Board column and the real board name on the others', () => {
    renderIdeas('OrgAdmin')
    expect(within(rowOf('mine-pool')).getByText('No board')).toBeTruthy()
    expect(within(rowOf('mine-live')).getByText('Assembly')).toBeTruthy()
    expect(within(rowOf('mine-live')).queryByText('No board')).toBeNull()
  })
})

describe('Ideas list: Remove from board on a row', () => {
  it('offers a User the working control on their own live idea only', () => {
    renderIdeas('User')
    expect(detach('mine-live')).not.toBeNull()
    expect(detach('mine-live')?.getAttribute('aria-disabled')).toBeNull()
    expect(detach('theirs-live')).toBeNull()
  })

  it('offers an Org Admin the control on an idea someone else wrote', () => {
    renderIdeas('OrgAdmin')
    expect(detach('theirs-live')).not.toBeNull()
    expect(detach('theirs-live')?.getAttribute('aria-disabled')).toBeNull()
  })

  it('offers nothing on a pool idea, for anyone', () => {
    renderIdeas('OrgAdmin')
    expect(detach('mine-pool')).toBeNull()
  })

  it('shows an Issue disabled with its reason', () => {
    renderIdeas('OrgAdmin')
    expect(detach('mine-issue')?.getAttribute('aria-disabled')).toBe('true')
    expect(within(rowOf('mine-issue')).getByText('Issues return to Discovery first.')).toBeTruthy()
  })

  it('shows a User an archived board idea disabled, and an Org Admin a working control', () => {
    renderIdeas('User')
    expect(detach('mine-archived')?.getAttribute('aria-disabled')).toBe('true')
    expect(
      within(rowOf('mine-archived')).getByText(
        'Only an Org Admin can remove ideas from an archived board.',
      ),
    ).toBeTruthy()
  })

  it('lets an Org Admin use the control on an archived board idea', () => {
    renderIdeas('OrgAdmin')
    expect(detach('mine-archived')?.getAttribute('aria-disabled')).toBeNull()
  })

  it.each(['ReadOnly', 'SiteAdmin'] as const)('offers %s no control at all', (role) => {
    renderIdeas(role)
    expect(screen.queryAllByRole('button', { name: /^Remove from board/ })).toEqual([])
  })

  it('offers no row control on a board page, where the drawer carries it instead', () => {
    renderIdeas('OrgAdmin', {
      board: {
        id: 'open',
        name: 'Assembly',
        lanes: [{ id: 's1', name: 'New', color: '#999' }],
        isArchived: false,
        canMove: true,
        canReorder: true,
      },
    })
    expect(screen.queryAllByRole('button', { name: /^Remove from board/ })).toEqual([])
  })
})

describe('the create drawer: Board default by entry point', () => {
  const create = { mode: 'create' as const, idea: null, formOptions: FORM_OPTIONS }
  const boardField = () => screen.getByLabelText(/^Board/) as HTMLSelectElement

  it('opens on No board from the Ideas list', () => {
    renderIdeas('User', { drawer: create })
    expect(boardField().value).toBe('')
    expect(boardField().selectedOptions[0]?.textContent).toBe('No board')
  })

  it('opens on the board when started from that board page', () => {
    renderIdeas('User', {
      drawer: create,
      board: {
        id: 'open',
        name: 'Assembly',
        lanes: [{ id: 's1', name: 'New', color: '#999' }],
        isArchived: false,
        canMove: true,
        canReorder: false,
      },
    })
    expect(boardField().value).toBe('open')
  })
})
