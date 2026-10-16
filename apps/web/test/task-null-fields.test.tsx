import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaRow } from '@/components/home/home-parts'
import { IdeaView } from '@/components/ideas/idea-view'
import { toIdea, toIdeaDetail } from '@/lib/api/adapt'
import { apiGet } from '@/lib/api/client'
import type { WireIdeaDetail, WireIdeaListItem } from '@/lib/api/wire'
import { getOrganizationHome } from '@/lib/data/home'
import type { HomeIdea } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * A board task has no priority, problem, proposed solutions or impact rationale
 * (SPEC/decisions.md 2026-10-16 "Metric types are an organization table...", the board-task
 * bullet; contracts/ideas.md "Tasks and item keys"): the API sends `null` and `[]`, and the client
 * must carry that through without throwing, without inventing a value, and without drawing an
 * empty section. Home is the sharpest case: an unknown priority there used to read as `Low`.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))
vi.mock('@/lib/server/idea-actions', () => ({
  addComment: vi.fn(),
  setFollowing: vi.fn(),
  toggleUpvote: vi.fn(),
}))

const WIRE_DETAIL: WireIdeaDetail = {
  ideaId: 'i-1',
  boardId: 'b-1',
  title: 'Wire the form',
  problem: 'Onboarding takes too long.',
  proposedSolutions: ['Cut the number of forms.'],
  impactRationale: 'Faster activation.',
  description: null,
  priority: 'High',
  ideaTypeId: 't-1',
  ideaTypeName: 'Continuous Improvement',
  businessImpactId: 'bi-1',
  businessImpactName: 'Medium',
  dueDate: null,
  assignees: [],
  tagNames: [],
  tags: [],
  statusId: 's-1',
  statusName: 'New',
  mentions: [],
  comments: [],
  fieldValues: [],
  formFields: [],
  upvoteCount: 0,
  hasUpvoted: false,
  commentCount: 0,
  author: null,
  createdAtUtc: '2026-09-04T03:55:41.000Z',
  isFollowing: false,
  followerCount: 0,
}

const TASK_DETAIL: WireIdeaDetail = {
  ...WIRE_DETAIL,
  problem: null,
  proposedSolutions: [],
  impactRationale: null,
  priority: null,
}

function view(wire: WireIdeaDetail) {
  return render(
    <IdeaView
      idea={toIdeaDetail(wire)}
      statusColor="#123456"
      engagementDenial={null}
      followDenial={null}
    />,
  )
}

describe('toIdeaDetail', () => {
  it('carries a task’s nulls through as nulls and an empty list', () => {
    const detail = toIdeaDetail(TASK_DETAIL)

    expect(detail.priority).toBeNull()
    expect(detail.problem).toBeNull()
    expect(detail.impactRationale).toBeNull()
    expect(detail.proposedSolutions).toEqual([])
  })

  it('still refuses a priority the client does not know', () => {
    expect(() => toIdeaDetail({ ...WIRE_DETAIL, priority: 'Urgent' })).toThrow(/unknown priority/)
  })
})

describe('toIdea', () => {
  it('adapts a list item with a null priority and keeps the known ones', () => {
    const item = {
      ideaId: 'i-1',
      boardId: 'b-1',
      title: 'Wire the form',
      ideaTypeName: 'x',
      businessImpactName: 'y',
      assignees: [],
      tagNames: [],
      tags: [],
      effort: null,
      statusId: 's-1',
      statusName: 'New',
      upvoteCount: 0,
      hasUpvoted: false,
      commentCount: 0,
      authorUserId: null,
      createdAtUtc: '2026-09-04T03:55:41.000Z',
    }

    expect(toIdea({ ...item, priority: null } as unknown as WireIdeaListItem).priority).toBeNull()
    expect(toIdea({ ...item, priority: 'Low' } as unknown as WireIdeaListItem).priority).toBe('Low')
  })
})

describe('IdeaView', () => {
  it('draws the priority and the three structured sections for an ordinary idea', () => {
    view(WIRE_DETAIL)

    expect(screen.getByText('Priority')).toBeTruthy()
    expect(screen.getByText('Problem')).toBeTruthy()
    expect(screen.getByText('Proposed solutions')).toBeTruthy()
    expect(screen.getByText('Impact rationale')).toBeTruthy()
    expect(screen.getByText('Onboarding takes too long.')).toBeTruthy()
  })

  it('hides the priority fact and all three sections for a task', () => {
    view(TASK_DETAIL)

    expect(screen.queryByText('Priority')).toBeNull()
    expect(screen.queryByText('Problem')).toBeNull()
    expect(screen.queryByText('Proposed solutions')).toBeNull()
    expect(screen.queryByText('Impact rationale')).toBeNull()
  })

  it('still draws the status and the title-side facts for a task', () => {
    view(TASK_DETAIL)

    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('shows a section on its own when only that one is present', () => {
    view({ ...TASK_DETAIL, problem: 'Only a problem.' })

    expect(screen.getByText('Problem')).toBeTruthy()
    expect(screen.queryByText('Proposed solutions')).toBeNull()
    expect(screen.queryByText('Impact rationale')).toBeNull()
  })

  it('shows the solutions section as soon as there is one solution', () => {
    view({ ...TASK_DETAIL, proposedSolutions: ['Do the thing.'] })

    expect(screen.getByText('Proposed solutions')).toBeTruthy()
    expect(screen.getByText('Do the thing.')).toBeTruthy()
  })
})

const NOW = new Date('2026-09-10T00:00:00Z')
const homeIdea = (priority: HomeIdea['priority']): HomeIdea => ({
  id: 'i-1',
  title: 'Slow conveyor',
  boardName: 'Assembly',
  ideaType: 'Problem',
  status: { id: 's-new', name: 'New', color: '#111111' },
  priority,
  createdAtUtc: '2026-09-01T10:00:00Z',
  upvotes: 3,
  hasUpvoted: false,
})

describe('Home', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset()
  })

  const page = (totalCount: number, items: unknown[] = []) => ({
    items,
    totalCount,
    page: 1,
    pageSize: 5,
  })
  const wireIdea = (priority: string | null) => ({
    ideaId: 'i-1',
    boardId: 'b-live',
    title: 'Slow conveyor',
    priority,
    ideaTypeName: 'Problem',
    statusId: 's-new',
    statusName: 'New',
    createdAtUtc: '2026-09-01T10:00:00Z',
    upvoteCount: 3,
    hasUpvoted: false,
  })

  function answerWith(priority: string | null) {
    vi.mocked(apiGet).mockImplementation(async (_reader, path) => {
      const url = new URL(String(path), 'http://api.test')
      const p = url.searchParams
      if (url.pathname.endsWith('/boards')) {
        return [
          {
            boardId: 'b-live',
            name: 'Assembly',
            isArchived: false,
            ideaCount: 3,
            swimlaneCount: 0,
            laneCounts: [],
            topTags: [],
            tagCount: 0,
            createdAtUtc: '2026-08-01T00:00:00Z',
            createdBy: null,
            description: null,
            allowUserStatusUpdate: true,
            archivedAtUtc: null,
          },
        ]
      }
      if (url.pathname.endsWith('/sprints')) return []
      if (url.pathname.endsWith('/statuses')) {
        return [{ statusId: 's-new', name: 'New', color: '#111111' }]
      }
      if (url.pathname.endsWith('/delivery')) return []
      if (url.pathname.endsWith('/ideas')) {
        if (p.get('boardId') === 'none') return page(0)
        return p.get('pageSize') === '5' ? page(1, [wireIdea(priority)]) : page(1)
      }
      throw new Error(`unanswered request ${path}`)
    })
  }

  it('reads a null priority as none, not as Low', async () => {
    answerWith(null)
    actAs('OrgAdmin')

    const home = await getOrganizationHome()

    expect(home.attention.rows[0]?.priority).toBeNull()
    expect(home.assigned.rows[0]?.priority).toBeNull()
  })

  it('still reads the known priorities', async () => {
    actAs('OrgAdmin')
    for (const [wire, expected] of [
      ['Critical', 'Critical'],
      ['Medium', 'Medium'],
      ['Low', 'Low'],
    ] as const) {
      answerWith(wire)
      const home = await getOrganizationHome()
      expect(home.attention.rows[0]?.priority).toBe(expected)
    }
  })

  it('draws no priority marker for a row whose priority is null, and one for a row that has it', () => {
    const { rerender } = render(<IdeaRow idea={homeIdea(null)} detail="priority" now={NOW} />)
    expect(screen.queryByText('Low')).toBeNull()
    expect(screen.queryByText('Medium')).toBeNull()
    expect(screen.getByText('Slow conveyor')).toBeTruthy()

    rerender(<IdeaRow idea={homeIdea('Medium')} detail="priority" now={NOW} />)
    expect(screen.getByText('Medium')).toBeTruthy()
  })
})
