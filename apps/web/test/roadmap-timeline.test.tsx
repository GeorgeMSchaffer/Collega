import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoadmapTimeline } from '@/components/delivery/roadmap-timeline'
import type { Sprint, SprintState } from '@/lib/types'

/**
 * The Roadmap's timeline as drawn in the browser: the zoom from `?zoom=`, which sprints get a row,
 * the Active bar's link to the Sprint board, and where a short bar's words sit. The clock is fixed
 * at local noon on Monday 2026-09-28.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }))

beforeEach(() => {
  search.params = new URLSearchParams()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 28, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

function sprint(id: string, state: SprintState, startDate: string, endDate: string): Sprint {
  return {
    id,
    name: `Sprint ${id}`,
    goal: null,
    startsOn: startDate,
    endsOn: endDate,
    startDate,
    endDate,
    window: '',
    state,
    issueCount: 4,
    doneCount: 1,
  }
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Sprints' }))
    .getAllByRole('listitem')
    .map((row) => row.textContent)

describe('RoadmapTimeline', () => {
  it('defaults to Months and marks it pressed', () => {
    render(<RoadmapTimeline sprints={[]} />)
    expect(screen.getByRole('button', { name: 'Months' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('JAN 27')).toBeTruthy()
  })

  it('reads ?zoom=quarters', () => {
    search.params = new URLSearchParams('zoom=quarters')
    render(<RoadmapTimeline sprints={[]} />)
    expect(screen.getByRole('button', { name: 'Quarters' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByText('Q3 2026')).toBeTruthy()
  })

  it('writes the zoom to the URL, leaving the default out', () => {
    const replace = vi.spyOn(window.history, 'replaceState')
    search.params = new URLSearchParams('zoom=weeks&x=1')
    render(<RoadmapTimeline sprints={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quarters' }))
    expect(replace.mock.calls.at(-1)?.[2]).toMatch(/\?zoom=quarters&x=1$|\?x=1&zoom=quarters$/)
    fireEvent.click(screen.getByRole('button', { name: 'Months' }))
    expect(replace.mock.calls.at(-1)?.[2]).toMatch(/\?x=1$/)
  })

  it('says so when no sprint meets the window', () => {
    render(<RoadmapTimeline sprints={[sprint('old', 'Completed', '2026-01-05', '2026-01-18')]} />)
    expect(screen.getByText('No sprints in this window.')).toBeTruthy()
  })

  it('shows the sprints that meet the window, by start date, and drops the rest', () => {
    render(
      <RoadmapTimeline
        sprints={[
          sprint('late', 'Planned', '2026-11-02', '2026-11-15'),
          sprint('gone', 'Completed', '2026-06-01', '2026-06-14'),
          sprint('edge', 'Completed', '2026-08-20', '2026-09-01'),
          sprint('now', 'Active', '2026-09-21', '2026-10-04'),
        ]}
      />,
    )
    const names = ['edge', 'now', 'late', 'gone']
    expect(rows().map((text) => names.find((n) => text?.startsWith(`Sprint ${n}`)))).toEqual([
      'edge',
      'now',
      'late',
    ])
  })

  it('links only the Active sprint’s bar to the Sprint board', () => {
    render(
      <RoadmapTimeline
        sprints={[
          sprint('now', 'Active', '2026-09-21', '2026-10-04'),
          sprint('next', 'Planned', '2026-10-05', '2026-10-18'),
        ]}
      />,
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe('/delivery/sprint')
    expect(links[0]?.getAttribute('aria-label')).toBe(
      'Sprint now, 1 / 4 done — open the Sprint board',
    )
  })

  it('puts a short bar’s words before it when it ends at the right edge', () => {
    search.params = new URLSearchParams('zoom=weeks')
    // Weeks from 2026-09-14 to 2027-01-04: a sprint ending on the window's last day.
    render(
      <RoadmapTimeline
        sprints={[
          sprint('first', 'Planned', '2026-09-14', '2026-09-16'),
          sprint('last', 'Planned', '2027-01-01', '2027-01-03'),
        ]}
      />,
    )
    const beside = screen
      .getAllByText('1 / 4 DONE')
      .filter((node) => node.className.includes('absolute'))
    expect(beside).toHaveLength(2)
    expect(beside[0]?.className).toContain('left-full')
    expect(beside[1]?.className).toContain('right-full')
  })
})
