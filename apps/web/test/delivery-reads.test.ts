import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sprintWindow, toIssue } from '@/lib/api/adapt'
import { apiGet } from '@/lib/api/client'
import type { WireDeliveryCard, WireSprint } from '@/lib/api/wire'
import { getBoardSprint } from '@/lib/data/delivery'
import { mayWorkOnIssue, type Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * The Sprint board's reads (`20-feature-issues-and-delivery.md` "Sprint board (comp R)"): which
 * sprint it shows, the WINDOW cell, an Issue off the wire, and who may move one. The API client is
 * the boundary.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

beforeEach(() => {
  actAs('OrgAdmin')
})

describe('sprintWindow', () => {
  it('names the month once within a month', () => {
    expect(sprintWindow('2026-09-10', '2026-09-24')).toBe('10–24 SEP')
  })

  it('names both months across two', () => {
    expect(sprintWindow('2026-09-28', '2026-10-05')).toBe('28 SEP – 5 OCT')
  })

  it('names both across the turn of the year', () => {
    expect(sprintWindow('2026-12-28', '2027-01-08')).toBe('28 DEC – 8 JAN')
  })

  it('names both for the same month in different years', () => {
    expect(sprintWindow('2026-09-01', '2027-09-10')).toBe('1 SEP – 10 SEP')
  })

  it('reads a one-day sprint', () => {
    expect(sprintWindow('2026-03-31', '2026-03-31')).toBe('31–31 MAR')
  })
})

function wireSprint(id: string, state: string, startDate: string, name = `Sprint ${id}`) {
  return {
    sprintId: id,
    name,
    goal: null,
    startDate,
    endDate: '2026-12-31',
    state,
    issueCount: 0,
    doneCount: 0,
  } satisfies WireSprint
}

describe('the Sprint board’s sprint', () => {
  const answer = (sprints: WireSprint[]) => vi.mocked(apiGet).mockResolvedValue(sprints)

  it('is the Active one, even when a Planned one starts earlier', async () => {
    answer([wireSprint('p', 'Planned', '2026-01-01'), wireSprint('a', 'Active', '2026-09-01')])
    expect((await getBoardSprint())?.id).toBe('a')
  })

  it('is the first Active one the list returns when there are several', async () => {
    answer([wireSprint('a2', 'Active', '2026-10-01'), wireSprint('a1', 'Active', '2026-09-01')])
    expect((await getBoardSprint())?.id).toBe('a2')
  })

  it('is the earliest-starting Planned one when none is Active', async () => {
    answer([
      wireSprint('c', 'Completed', '2026-01-01'),
      wireSprint('late', 'Planned', '2026-11-01'),
      wireSprint('early', 'Planned', '2026-10-01'),
    ])
    expect((await getBoardSprint())?.id).toBe('early')
  })

  it('breaks a start-date tie by name', async () => {
    answer([
      wireSprint('z', 'Planned', '2026-10-01', 'Zeta'),
      wireSprint('a', 'Planned', '2026-10-01', 'Alpha'),
    ])
    expect((await getBoardSprint())?.id).toBe('a')
  })

  it('is nothing when every sprint is Completed', async () => {
    answer([wireSprint('c', 'Completed', '2026-01-01')])
    expect(await getBoardSprint()).toBeNull()
  })

  it('is nothing with no sprints', async () => {
    answer([])
    expect(await getBoardSprint()).toBeNull()
  })
})

function card(overrides: Partial<WireDeliveryCard> = {}): WireDeliveryCard {
  return {
    ideaId: 'idea-1',
    boardId: 'board-1',
    title: 'Faster changeovers',
    authorUserId: 'author',
    effort: 'Medium',
    deliveryStatus: 'Review',
    sprint: { sprintId: 's1', name: 'Sprint 7', startDate: '2026-09-28', endDate: '2026-10-09' },
    assignees: [
      { userId: 'u1', firstName: 'Ana', lastName: 'Lima', displayName: 'Ana Lima', isActive: true },
    ],
    tags: [{ tagId: 't1', name: 'safety', color: '#E5484D' }],
    upvoteCount: 9,
    taskSummary: { done: 1, total: 3 },
    provenance: {
      promotedAtUtc: '2026-09-20T23:30:00Z',
      promotedByDisplayName: 'Olivia Admin',
      upvoteCountAtPromotion: 5,
    },
    ...overrides,
  }
}

describe('toIssue', () => {
  it('carries the card’s delivery facts', () => {
    const issue = toIssue(card())
    expect(issue).toMatchObject({
      id: 'idea-1',
      deliveryStatusId: 'Review',
      effort: 'Medium',
      sprintId: 's1',
      sprint: { id: 's1', name: 'Sprint 7', window: '28 SEP – 9 OCT' },
      outcomeId: null,
      assigneeInitials: 'AL',
      assignees: [{ id: 'u1', name: 'Ana Lima', initials: 'AL' }],
      tags: [{ id: 't1', name: 'safety', color: '#E5484D' }],
      upvotes: 9,
      upvotesAtPromotion: 5,
      taskSummary: { done: 1, total: 3 },
      promotedOn: 'Sep 20, 2026',
      promotedBy: 'Olivia Admin',
    })
  })

  it('reads a backlog card with no sprint, no assignee and no snapshot', () => {
    const issue = toIssue(
      card({
        sprint: null,
        assignees: [],
        provenance: {
          promotedAtUtc: null,
          promotedByDisplayName: null,
          upvoteCountAtPromotion: null,
        },
      }),
    )
    expect(issue).toMatchObject({
      sprint: null,
      sprintId: null,
      assigneeInitials: null,
      upvotesAtPromotion: 9,
      promotedOn: null,
    })
  })

  it('refuses a card with no effort or no delivery status rather than dropping it', () => {
    expect(() => toIssue(card({ effort: null }))).toThrow(/effort/)
    expect(() => toIssue(card({ deliveryStatus: 'Done' }))).toThrow(/delivery status/)
  })
})

describe('mayWorkOnIssue', () => {
  const issue = { authorUserId: 'author', assignees: [{ id: 'assignee' }] }
  const cases: [Role, string, boolean][] = [
    ['OrgAdmin', 'someone', true],
    ['User', 'author', true],
    ['User', 'assignee', true],
    ['User', 'someone', false],
    ['ReadOnly', 'author', false],
    ['ReadOnly', 'assignee', false],
    ['SiteAdmin', 'author', false],
    ['SiteAdmin', 'someone', false],
  ]
  for (const [role, userId, expected] of cases) {
    it(`${expected ? 'lets' : 'refuses'} ${role} ${userId}`, () => {
      expect(mayWorkOnIssue(role, userId, issue)).toBe(expected)
    })
  }
})
