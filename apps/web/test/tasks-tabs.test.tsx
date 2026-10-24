import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TasksTabs } from '@/components/tasks/tasks-tabs'

/** The Tasks page's tabs (TB-8): four links to `?tab=`, the current one marked, a Backlog count. */
describe('TasksTabs', () => {
  it('offers Backlog, My tasks, In sprint and All in that order, each linking to its tab', () => {
    render(<TasksTabs active="backlog" backlogCount={3} />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tasks?tab=backlog',
      '/tasks?tab=mine',
      '/tasks?tab=sprint',
      '/tasks?tab=all',
    ])
    expect(links.map((link) => link.textContent?.replace(/\d+$/, ''))).toEqual([
      'Backlog',
      'My tasks',
      'In sprint',
      'All',
    ])
  })

  it.each([
    ['backlog', 'Backlog'],
    ['mine', 'My tasks'],
    ['sprint', 'In sprint'],
    ['all', 'All'],
  ] as const)('marks only %s as the current page', (tab, label) => {
    render(<TasksTabs active={tab} backlogCount={0} />)
    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toContain(label)
  })

  it('shows the backlog count on the Backlog tab only', () => {
    render(<TasksTabs active="all" backlogCount={12} />)
    expect(screen.getByRole('link', { name: /^Backlog\s*12$/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'All' })).toBeTruthy()
  })

  it('shows a zero count rather than hiding it', () => {
    render(<TasksTabs active="backlog" backlogCount={0} />)
    expect(screen.getByRole('link', { name: /^Backlog\s*0$/ })).toBeTruthy()
  })
})
