import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SprintsTab } from '@/components/boards/sprints-tab'
import type { Sprint } from '@/lib/types'

/**
 * The Sprints tab list (TB-5, TB-10, comp W): each sprint's state chip, window and task count, the
 * Backlog's "N tasks waiting", and "+ New sprint" for an admin only. The create drawer is its own
 * suite, so it is stubbed here.
 */
vi.mock('@/components/boards/sprint-create-drawer', () => ({
  SprintCreateDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-drawer" /> : null,
}))

const sprint = (id: string, over: Partial<Sprint> = {}): Sprint => ({
  id,
  name: `Sprint ${id}`,
  goal: null,
  startsOn: '',
  endsOn: '',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  window: '2–13 NOV',
  state: 'Planned',
  issueCount: 0,
  doneCount: 0,
  ...over,
})

const tab = (over: Partial<Parameters<typeof SprintsTab>[0]> = {}) =>
  render(
    <SprintsTab
      boardId="b-1"
      boardName="Implementation"
      sprints={[]}
      waiting={0}
      backlog={[]}
      members={[]}
      canPlan
      {...over}
    />,
  )

describe('Sprints tab list', () => {
  it('shows each sprint with its state chip, window and task count, linking to its planning page', () => {
    tab({
      sprints: [
        sprint('a', { name: 'Alpha', state: 'Active', issueCount: 3 }),
        sprint('p', { name: 'Plan', state: 'Planned', issueCount: 1, window: '16–27 NOV' }),
      ],
    })
    const items = within(
      screen.getByRole('list', { name: 'Sprints on Implementation' }),
    ).getAllByRole('listitem') as HTMLElement[]
    expect(items).toHaveLength(2)
    expect(within(items[0] as HTMLElement).getByText('Active')).toBeTruthy()
    expect(within(items[0] as HTMLElement).getByText('3 tasks')).toBeTruthy()
    expect(within(items[1] as HTMLElement).getByText('Planned')).toBeTruthy()
    expect(within(items[1] as HTMLElement).getByText('16–27 NOV')).toBeTruthy()
    expect(within(items[1] as HTMLElement).getByText('1 task')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Alpha/ }).getAttribute('href')).toBe(
      '/boards/b-1/sprints/a',
    )
  })

  it('shows the done count for a Completed sprint only', () => {
    tab({
      sprints: [
        sprint('c', { state: 'Completed', issueCount: 4, doneCount: 3 }),
        sprint('a', { state: 'Active', issueCount: 4, doneCount: 1 }),
      ],
    })
    expect(screen.getByText('4 tasks · 3 done')).toBeTruthy()
    expect(screen.queryByText(/1 done/)).toBeNull()
  })

  it('escapes the ids in the planning link', () => {
    tab({ boardId: 'b/1', sprints: [sprint('s 1', { name: 'Odd' })] })
    expect(screen.getByRole('link', { name: /Odd/ }).getAttribute('href')).toBe(
      '/boards/b%2F1/sprints/s%201',
    )
  })

  it('says how many tasks wait in the Backlog, singular and plural', () => {
    const { unmount } = tab({ waiting: 5 })
    expect(screen.getByRole('status').textContent).toBe('5 tasks waiting in the Backlog')
    unmount()
    tab({ waiting: 1 })
    expect(screen.getByRole('status').textContent).toBe('1 task waiting in the Backlog')
  })

  it('says 0 tasks waiting rather than hiding the line', () => {
    tab({ waiting: 0 })
    expect(screen.getByRole('status').textContent).toBe('0 tasks waiting in the Backlog')
  })

  it('shows an empty state with no sprints, inviting an admin to create one', () => {
    tab({ sprints: [] })
    expect(screen.getByText('No sprints yet')).toBeTruthy()
    expect(screen.getByText(/Create the first sprint for Implementation/)).toBeTruthy()
    expect(screen.queryByRole('list', { name: /Sprints on/ })).toBeNull()
  })
})

describe('Sprints tab + New sprint', () => {
  it('is offered to an admin and opens the create drawer', () => {
    tab({ canPlan: true })
    expect(screen.queryByTestId('create-drawer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '+ New sprint' }))
    expect(screen.getByTestId('create-drawer')).toBeTruthy()
  })

  it('is absent for a reader who cannot plan, who also gets a plain empty state and no drawer', () => {
    tab({ canPlan: false, sprints: [] })
    expect(screen.queryByRole('button', { name: /New sprint/ })).toBeNull()
    expect(screen.getByText('Implementation has no sprints yet.')).toBeTruthy()
    expect(screen.queryByText(/Create the first sprint/)).toBeNull()
  })

  it('still lists the sprints and the waiting count for a reader who cannot plan', () => {
    tab({ canPlan: false, waiting: 2, sprints: [sprint('a', { name: 'Alpha' })] })
    expect(screen.getByRole('link', { name: /Alpha/ })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('2 tasks waiting')
    expect(screen.queryByRole('button', { name: /New sprint/ })).toBeNull()
  })
})
