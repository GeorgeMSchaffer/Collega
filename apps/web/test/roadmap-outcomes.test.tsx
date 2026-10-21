import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutcomeStateText } from '@/components/delivery/outcome-state'
import { RoadmapTimeline } from '@/components/delivery/roadmap-timeline'
import { outcome } from './support/outcomes'

/**
 * The Roadmap's Outcome rows: the target-window bar, the sprint-span line, the TODAY rule and the
 * State text. The clock is fixed at local noon on Monday 2026-09-28; Months then spans
 * 2026-09-01 to 2027-04-01 (212 days), so every position below is a count of days over 212.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }))

const DAYS = 212

function setToday(year: number, month: number, day: number) {
  vi.setSystemTime(new Date(year, month - 1, day, 12, 0))
}

beforeEach(() => {
  search.params = new URLSearchParams()
  vi.useFakeTimers({ toFake: ['Date'] })
  setToday(2026, 9, 28)
})
afterEach(() => {
  vi.useRealTimers()
})

const outcomeRows = () =>
  within(screen.getByRole('list', { name: 'Outcomes' })).getAllByRole('listitem')

/** A percentage property out of an inline style, e.g. `left: 14.15%` or `width: max(43.4%, 6px)`. */
const percent = (style: string, property: string) => {
  const match = new RegExp(`${property}:\\s*(?:max\\()?([\\d.]+)%`).exec(style)
  return match ? Number(match[1]) : Number.NaN
}

describe('Roadmap Outcome rows', () => {
  it('says so when no outcome meets the window', () => {
    render(
      <RoadmapTimeline
        sprints={[]}
        outcomes={[outcome({ targetStartDate: '2025-01-01', targetEndDate: '2025-03-31' })]}
      />,
    )
    expect(screen.getByText('No outcomes in this window.')).toBeTruthy()
  })

  it('says so when there are no outcomes at all', () => {
    render(<RoadmapTimeline sprints={[]} />)
    expect(screen.getByText('No outcomes in this window.')).toBeTruthy()
  })

  it('draws the target window as a bar placed by its days, end day included', () => {
    render(<RoadmapTimeline sprints={[]} outcomes={[outcome()]} />)
    const bar = within(outcomeRows()[0] as HTMLElement).getByRole('link', {
      name: 'Faster onboarding, Oct 1, 2026 to Dec 31, 2026',
    })
    const style = bar.getAttribute('style') ?? ''
    // Oct 1 is day 30 of the window; Oct 1 to Dec 31 inclusive is 92 days.
    expect(percent(style, 'left')).toBeCloseTo((30 / DAYS) * 100, 2)
    expect(percent(style, 'width')).toBeCloseTo((92 / DAYS) * 100, 2)
  })

  it('clips a window that starts before the visible window to the left edge', () => {
    render(
      <RoadmapTimeline
        sprints={[]}
        outcomes={[outcome({ targetStartDate: '2026-06-01', targetEndDate: '2026-09-30' })]}
      />,
    )
    const bar = within(outcomeRows()[0] as HTMLElement).getByRole('link', {
      name: /Faster onboarding, /,
    })
    const style = bar.getAttribute('style') ?? ''
    expect(percent(style, 'left')).toBe(0)
    expect(percent(style, 'width')).toBeCloseTo((30 / DAYS) * 100, 2)
  })

  it('keeps an outcome that ends on the window’s first day and drops one that ended the day before', () => {
    render(
      <RoadmapTimeline
        sprints={[]}
        outcomes={[
          outcome({
            id: 'in',
            name: 'Touches',
            targetStartDate: '2026-08-01',
            targetEndDate: '2026-09-01',
          }),
          outcome({
            id: 'out',
            name: 'Missed',
            targetStartDate: '2026-08-01',
            targetEndDate: '2026-08-31',
          }),
        ]}
      />,
    )
    const rows = outcomeRows().map((row) => row.textContent ?? '')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatch(/^Touches/)
  })

  it('links the name and the bar to the Outcome page', () => {
    render(<RoadmapTimeline sprints={[]} outcomes={[outcome({ id: 'o-42' })]} />)
    const links = within(outcomeRows()[0] as HTMLElement).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/delivery/outcomes/o-42',
      '/delivery/outcomes/o-42',
    ])
  })

  it('labels a not-yet-started outcome with nothing done as planned', () => {
    render(
      <RoadmapTimeline sprints={[]} outcomes={[outcome({ ideaCount: 3, doneIdeaCount: 0 })]} />,
    )
    expect(screen.getByText('PLANNED · 0 / 3')).toBeTruthy()
  })

  it('labels a started outcome by its done count, not as planned', () => {
    render(
      <RoadmapTimeline
        sprints={[]}
        outcomes={[
          outcome({
            targetStartDate: '2026-09-01',
            targetEndDate: '2026-11-30',
            ideaCount: 4,
            doneIdeaCount: 1,
          }),
        ]}
      />,
    )
    expect(screen.getByText('1 / 4 DONE')).toBeTruthy()
    expect(screen.queryByText(/PLANNED/)).toBeNull()
  })

  it('does not call an outcome planned on its first day', () => {
    render(
      <RoadmapTimeline
        sprints={[]}
        outcomes={[
          outcome({ targetStartDate: '2026-09-28', targetEndDate: '2026-11-30', ideaCount: 2 }),
        ]}
      />,
    )
    expect(screen.getByText('0 / 2 DONE')).toBeTruthy()
  })

  it('does not call a future outcome planned once an item in it is done', () => {
    render(
      <RoadmapTimeline sprints={[]} outcomes={[outcome({ ideaCount: 3, doneIdeaCount: 1 })]} />,
    )
    expect(screen.getByText('1 / 3 DONE')).toBeTruthy()
  })

  it('draws the sprint-span line from the items’ sprints, and none without sprints', () => {
    const { container, rerender } = render(
      <RoadmapTimeline
        sprints={[]}
        outcomes={[outcome({ sprintStart: '2026-10-05', sprintEnd: '2026-11-15' })]}
      />,
    )
    const line = container.querySelector('[title^="Sprints: "]') as HTMLElement
    expect(line.getAttribute('title')).toBe('Sprints: Oct 5 – Nov 15, 2026')
    const style = line.getAttribute('style') ?? ''
    // Oct 5 is day 34; Oct 5 to Nov 15 inclusive is 42 days.
    expect(percent(style, 'left')).toBeCloseTo((34 / DAYS) * 100, 2)
    expect(percent(style, 'width')).toBeCloseTo((42 / DAYS) * 100, 2)

    rerender(<RoadmapTimeline sprints={[]} outcomes={[outcome()]} />)
    expect(container.querySelector('[title^="Sprints: "]')).toBeNull()
  })
})

describe('Roadmap TODAY marker', () => {
  const rule = () => screen.getByText('Today').parentElement as HTMLElement

  it('sits at today’s day across the window', () => {
    render(<RoadmapTimeline sprints={[]} />)
    // Sep 28 is day 27 of 212.
    expect(rule().getAttribute('style') ?? '').toContain(`260px + ${27 / DAYS} *`)
  })

  it('follows the viewer’s local date, not a fixed one', () => {
    setToday(2026, 10, 15)
    render(<RoadmapTimeline sprints={[]} />)
    // The window re-anchors on October (Oct 1 to May 1, 212 days): Oct 15 is day 14.
    expect(rule().getAttribute('style') ?? '').toContain(`260px + ${14 / 212} *`)
  })
})

describe('OutcomeStateText', () => {
  it('is Planned before the window, In its window inside it, Past its window after', () => {
    const { rerender } = render(<OutcomeStateText start="2026-10-01" end="2026-12-31" />)
    expect(screen.getByText('Planned')).toBeTruthy()

    rerender(<OutcomeStateText start="2026-09-01" end="2026-09-28" />)
    expect(screen.getByText('In its window')).toBeTruthy()

    rerender(<OutcomeStateText start="2026-08-01" end="2026-09-27" />)
    expect(screen.getByText('Past its window')).toBeTruthy()
  })
})
