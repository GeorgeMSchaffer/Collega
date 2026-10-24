import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { type BoardTab, BoardTabs } from '@/components/boards/board-tabs'

/** Comp W's tab bar: which tabs show is the page's call; the bar names them, marks one, and badges. */
function bar(
  tabs: BoardTab[],
  active: BoardTab,
  counts: Partial<Record<BoardTab, number>> = {},
  boardId = 'b-1',
) {
  render(<BoardTabs boardId={boardId} tabs={tabs} active={active} counts={counts} />)
}

describe('BoardTabs', () => {
  it('links each tab to its own ?tab= on the board', () => {
    bar(['board', 'backlog', 'sprints'], 'backlog')
    expect(screen.getByRole('link', { name: 'Board' }).getAttribute('href')).toBe(
      '/boards/b-1?tab=board',
    )
    expect(screen.getByRole('link', { name: /^Backlog/ }).getAttribute('href')).toBe(
      '/boards/b-1?tab=backlog',
    )
    expect(screen.getByRole('link', { name: 'Sprints' }).getAttribute('href')).toBe(
      '/boards/b-1?tab=sprints',
    )
  })

  it('marks only the active tab as the current page', () => {
    bar(['board', 'backlog'], 'backlog')
    expect(screen.getByRole('link', { name: /^Backlog/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Board' }).getAttribute('aria-current')).toBeNull()
  })

  it('shows only the tabs it is given', () => {
    bar(['board', 'backlog'], 'board')
    expect(screen.queryByRole('link', { name: 'Sprints' })).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('puts the waiting count beside a tab, zero included, and none beside a tab without one', () => {
    bar(['board', 'backlog', 'sprints'], 'board', { backlog: 7, sprints: 0 })
    expect(screen.getByRole('link', { name: /^Backlog\s*7$/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^Sprints\s*0$/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Board' })).toBeTruthy()
  })

  it('escapes the board id in the link', () => {
    bar(['board'], 'board', {}, 'a/b c')
    expect(screen.getByRole('link', { name: 'Board' }).getAttribute('href')).toBe(
      '/boards/a%2Fb%20c?tab=board',
    )
  })
})
