import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutcomePage from '@/app/(desk)/delivery/outcomes/[outcomeId]/page'
import type { OutcomeWithIdeas } from '@/lib/types'
import { outcome, outcomeIdea } from './support/outcomes'

/**
 * The Outcome page (`/delivery/outcomes/{id}`): window, State, owner, metric totals, the ideas and
 * tasks rollup, and the items table with its status filter. The data seam and identity are the
 * boundary; the page and the formatters are real. Clock fixed at local noon, 2026-09-28.
 */
const mocks = vi.hoisted(() => ({
  detail: null as unknown,
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  notFound: mocks.notFound,
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => ({}) }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/lib/data', () => ({
  getOutcomeDetail: async () => mocks.detail,
  getStatuses: async () => [
    { id: 's-open', name: 'Open', color: '#111111' },
    { id: 's-prog', name: 'In progress', color: '#222222' },
    { id: 's-done', name: 'Done', color: '#333333' },
    { id: 's-unused', name: 'Parked', color: '#444444' },
  ],
  getMemberOptions: async () => [
    { id: 'u-ann', name: 'Ann Lee' },
    { id: 'u-bo', name: 'Bo Chen' },
  ],
}))

beforeEach(() => {
  mocks.detail = null
  mocks.notFound.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 28, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

async function renderPage(detail: OutcomeWithIdeas | null, query: Record<string, string> = {}) {
  mocks.detail = detail
  render(
    await OutcomePage({
      params: Promise.resolve({ outcomeId: detail?.id ?? 'missing' }),
      searchParams: Promise.resolve(query),
    }),
  )
}

const fact = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent
}

/** A stat tile's text, by its label (`Ideas`, `Tasks`, a metric's name). */
const stat = (label: string) =>
  (screen.getByText(label, { selector: 'dt *, dt' }).closest('div') as HTMLElement).textContent

const itemRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent ?? '')

describe('Outcome page header facts', () => {
  it('writes the window, the State from today’s date, and the owner', async () => {
    await renderPage(outcome({ ownerUserId: 'u-ann' }))
    expect(fact('Window')).toBe('Oct 1 – Dec 31, 2026')
    expect(fact('State')).toBe('Planned')
    expect(fact('Owner')).toBe('Ann Lee')
  })

  it('says In its window while today is inside the window', async () => {
    await renderPage(outcome({ targetStartDate: '2026-09-01', targetEndDate: '2026-09-28' }))
    expect(fact('State')).toBe('In its window')
  })

  it('says No owner for none, and names a departed owner as no longer active', async () => {
    await renderPage(outcome({ ownerUserId: null }))
    expect(fact('Owner')).toBe('No owner')
    cleanup()
    await renderPage(outcome({ ownerUserId: 'u-gone' }))
    expect(fact('Owner')).toBe('Owner no longer active')
  })

  it('says None yet when no item has a sprint, else writes the sprint span', async () => {
    await renderPage(outcome())
    expect(fact('Sprints')).toBe('None yet')
    cleanup()
    await renderPage(outcome({ sprintStart: '2026-10-05', sprintEnd: '2026-11-15' }))
    expect(fact('Sprints')).toBe('Oct 5 – Nov 15, 2026')
  })

  it('falls back to a description placeholder', async () => {
    await renderPage(outcome({ description: null }))
    expect(screen.getByText('No description yet.')).toBeTruthy()
  })

  it('is a not-found for an Outcome the read could not find', async () => {
    await expect(renderPage(null)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalled()
  })
})

describe('Outcome page rollup', () => {
  it('shows ideas done and open, and tasks done of total with the remainder', async () => {
    await renderPage(outcome({ ideaCount: 5, doneIdeaCount: 2, taskCount: 9, doneTaskCount: 4 }))
    expect(stat('Ideas')).toContain('5')
    expect(stat('Ideas')).toContain('2 done · 3 open')
    expect(stat('Tasks')).toContain('4 of 9')
    expect(stat('Tasks')).toContain('5 not done')
  })

  it('shows zero counts rather than hiding the tiles on an empty Outcome', async () => {
    await renderPage(outcome())
    expect(stat('Ideas')).toContain('0 done · 0 open')
    expect(stat('Tasks')).toContain('0 of 0')
  })

  it('draws one tile per metric total: realized of projected, with the share', async () => {
    await renderPage(
      outcome({
        metricTotals: [
          { metricTypeId: 'm-1', name: 'Hours saved', unit: 'hrs', projected: 200, realized: 50 },
          { metricTypeId: 'm-2', name: 'Revenue', unit: '$', projected: null, realized: 1200 },
        ],
      }),
    )
    expect(stat('Hours saved')).toContain('50 hrs of 200 hrs')
    expect(stat('Hours saved')).toContain('25% of projected, realized')
    // No projection: the share is not computed, and the missing side is a dash.
    expect(stat('Revenue')).toContain('1,200 $ of —')
    expect(stat('Revenue')).toContain('projected and realized')
  })
})

describe('Outcome page items table', () => {
  const ideas = [
    outcomeIdea('a', { title: 'Alpha', statusId: 's-open', itemKey: 'OPS-1' }),
    outcomeIdea('b', { title: 'Beta', statusId: 's-prog', assigneeUserIds: ['u-ann', 'u-x'] }),
    outcomeIdea('c', { title: 'Gamma', statusId: 's-open' }),
  ]

  it('lists every item with its key, status name and a link to the idea', async () => {
    await renderPage(outcome({ ideas }))
    const rows = itemRows()
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('OPS-1')
    expect(rows[0]).toContain('Open')
    expect(screen.getByRole('link', { name: 'Alpha' }).getAttribute('href')).toBe('/ideas/a')
  })

  it('names assignees, using Unknown for one the member list lacks', async () => {
    await renderPage(outcome({ ideas }))
    expect(itemRows()[1]).toContain('Ann Lee, Unknown')
  })

  it('says No sprint for an unscheduled item and writes the sprint days otherwise', async () => {
    await renderPage(
      outcome({
        ideas: [
          outcomeIdea('a'),
          outcomeIdea('b', { sprintStart: '2026-10-05', sprintEnd: '2026-10-18' }),
        ],
      }),
    )
    const rows = itemRows()
    expect(rows[0]).toContain('No sprint')
    expect(rows[1]).toContain('Oct 5, 2026 – Oct 18, 2026')
  })

  it('shows an item’s realized values only for the metric types the Outcome totals', async () => {
    await renderPage(
      outcome({
        metricTotals: [
          { metricTypeId: 'm-1', name: 'Hours', unit: 'hrs', projected: 10, realized: 4 },
        ],
        ideas: [
          outcomeIdea('a', {
            metrics: [
              { metricTypeId: 'm-1', projected: 10, realized: 4 },
              { metricTypeId: 'm-archived', projected: 5, realized: 5 },
            ],
          }),
          outcomeIdea('b', { metrics: [{ metricTypeId: 'm-1', projected: 3, realized: null }] }),
        ],
      }),
    )
    const rows = itemRows()
    expect(rows[0]).toMatch(/4 hrs$/)
    expect(rows[1]).toMatch(/—$/)
  })

  it('shows the empty state and no table for an Outcome with no items', async () => {
    await renderPage(outcome())
    expect(screen.getByText('No ideas grouped here yet')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Outcome page status filter', () => {
  const ideas = [
    outcomeIdea('a', { title: 'Alpha', statusId: 's-open' }),
    outcomeIdea('b', { title: 'Beta', statusId: 's-prog' }),
    outcomeIdea('c', { title: 'Gamma', statusId: 's-open' }),
  ]
  const filterLinks = () =>
    within(screen.getByRole('navigation', { name: 'Filter by status' })).getAllByRole('link')

  it('offers All plus only the statuses the items hold, in the catalog’s order', async () => {
    await renderPage(outcome({ ideas }))
    expect(filterLinks().map((link) => link.textContent)).toEqual(['All', 'Open', 'In progress'])
    expect(filterLinks()[1]?.getAttribute('href')).toBe('?status=s-open')
    expect(filterLinks()[0]?.getAttribute('href')).toBe('/delivery/outcomes/o-1')
  })

  it('narrows the table to the picked status and marks it current', async () => {
    await renderPage(outcome({ ideas }), { status: 's-open' })
    expect(itemRows().map((row) => /Alpha|Beta|Gamma/.exec(row)?.[0])).toEqual(['Alpha', 'Gamma'])
    expect(filterLinks().map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ])
  })

  it('shows everything, with All current, for a status the items do not hold', async () => {
    await renderPage(outcome({ ideas }), { status: 's-unused' })
    expect(itemRows()).toHaveLength(3)
    expect(filterLinks()[0]?.getAttribute('aria-current')).toBe('true')
  })

  it('draws no filter when the items share one status', async () => {
    await renderPage(outcome({ ideas: [ideas[0] as (typeof ideas)[number]] }))
    expect(screen.queryByRole('navigation', { name: 'Filter by status' })).toBeNull()
  })
})
