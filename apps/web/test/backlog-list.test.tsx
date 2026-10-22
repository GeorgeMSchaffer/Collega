import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BacklogList } from '@/components/boards/backlog-list'
import type { Idea } from '@/lib/types'

/**
 * A work board's Backlog list (TB-1, comp W screens 1 and 5): the rows as sent, the filters that
 * narrow them, the "first N of T" honesty line, the empty state and who gets selection checkboxes.
 */
const ADA = { id: 'u-ada', name: 'Ada Lovelace', initials: 'AL' }
const BO = { id: 'u-bo', name: 'Bo Peep', initials: 'BP' }
const URGENT = { id: 't-1', name: 'urgent', color: '#CC0000' }
const LANES = [
  { id: 'l-1', name: 'To do', color: '#111111', isFinal: false },
  { id: 'l-2', name: 'Done', color: '#222222', isFinal: true },
]

const idea = (id: string, over: Partial<Idea> = {}): Idea => ({
  id,
  boardId: 'b-1',
  authorUserId: 'u-ada',
  statusId: 'l-1',
  statusName: 'To do',
  title: `Task ${id}`,
  priority: null,
  ideaType: 'Idea',
  businessImpact: 'Low',
  tag: null,
  tags: [],
  assigneeInitials: null,
  assignees: [],
  upvotes: 0,
  hasUpvoted: false,
  effort: null,
  itemKey: `W-${id}`,
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
  ...over,
})

const ROWS = [
  idea('1', { title: 'Standalone chore', assignees: [ADA], tags: [URGENT] }),
  idea('2', {
    title: 'Child of seven',
    parentIdeaId: 'p-7',
    parentItemKey: 'IDEA-7',
    assignees: [BO],
  }),
  idea('3', { title: 'Child of eight', parentIdeaId: 'p-8', parentItemKey: 'IDEA-8' }),
]

function list(over: Partial<Parameters<typeof BacklogList>[0]> = {}) {
  render(
    <BacklogList
      boardId="b-1"
      boardName="Implementation"
      rows={ROWS}
      total={ROWS.length}
      lanes={LANES}
      canSelect={false}
      newTaskHref="/boards/b-1?tab=backlog&task=new"
      {...over}
    />,
  )
}

const titles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).queryByRole('link')?.textContent)

function pick(filter: string, option: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${filter}`) }))
  fireEvent.click(
    within(screen.getByRole('dialog', { name: `${filter} filter` })).getByRole('checkbox', {
      name: option,
    }),
  )
}

describe('BacklogList rows', () => {
  it('lists every row as sent with its key, parent chip or standalone mark, and status', () => {
    list()
    expect(titles()).toEqual(['Standalone chore', 'Child of seven', 'Child of eight'])
    const rows = screen.getAllByRole('row')
    expect(within(rows[1] as HTMLElement).getByText('standalone')).toBeTruthy()
    expect(within(rows[2] as HTMLElement).getByText(/IDEA-7/)).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('W-1')).toBeTruthy()
  })

  it('opens a task on the Board tab with its drawer', () => {
    list()
    expect(screen.getByRole('link', { name: 'Standalone chore' }).getAttribute('href')).toBe(
      '/boards/b-1?tab=board&idea=1',
    )
  })
})

describe('BacklogList count line', () => {
  it('says how many tasks it shows', () => {
    list()
    expect(screen.getByRole('status').textContent).toContain('3 tasks')
  })

  it('says "1 task" for a single row', () => {
    list({ rows: [idea('1')], total: 1 })
    expect(screen.getByRole('status').textContent).toMatch(/\b1 task\b(?!s)/)
  })

  it('says "first N of T" when the board holds more than it was sent', () => {
    list({ total: 250 })
    expect(screen.getByRole('status').textContent).toContain('first 3 of 250')
  })

  it('does not say "first N of T" when everything arrived', () => {
    list()
    expect(screen.getByRole('status').textContent).not.toContain('first')
  })
})

describe('BacklogList filters', () => {
  it('searches title, key and parent key', async () => {
    list()
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    fireEvent.change(search, { target: { value: 'chore' } })
    await waitFor(() => expect(titles()).toEqual(['Standalone chore']))
    fireEvent.change(search, { target: { value: 'idea-8' } })
    await waitFor(() => expect(titles()).toEqual(['Child of eight']))
    fireEvent.change(search, { target: { value: 'W-2' } })
    await waitFor(() => expect(titles()).toEqual(['Child of seven']))
  })

  it('filters by parent idea', () => {
    list()
    pick('Parent idea', 'IDEA-7')
    expect(titles()).toEqual(['Child of seven'])
  })

  it('filters to standalone tasks', () => {
    list()
    pick('Parent idea', 'Standalone (no parent)')
    expect(titles()).toEqual(['Standalone chore'])
  })

  it('filters by assignee', () => {
    list()
    pick('Assignee', 'Bo Peep')
    expect(titles()).toEqual(['Child of seven'])
  })

  it('filters by tag', () => {
    list()
    pick('Tag', 'urgent')
    expect(titles()).toEqual(['Standalone chore'])
  })

  it('says how many of the rows match, and that nothing matches', async () => {
    list()
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    fireEvent.change(search, { target: { value: 'chore' } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 of 3 tasks'))
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(await screen.findByText('No task matches these filters.')).toBeTruthy()
  })
})

describe('BacklogList empty state', () => {
  it('says nothing is waiting and offers + New task when the reader may add one', () => {
    list({ rows: [], total: 0 })
    expect(screen.getByText('Nothing waiting for a sprint')).toBeTruthy()
    expect(screen.getByRole('link', { name: '+ New task' }).getAttribute('href')).toBe(
      '/boards/b-1?tab=backlog&task=new',
    )
  })

  it('offers no + New task to a reader who may not add one', () => {
    list({ rows: [], total: 0, newTaskHref: null })
    expect(screen.getByText('Nothing waiting for a sprint')).toBeTruthy()
    expect(screen.queryByRole('link', { name: '+ New task' })).toBeNull()
  })
})

describe('BacklogList selection', () => {
  it('has no checkboxes unless the reader can plan sprints', () => {
    list({ canSelect: false })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('has a checkbox per row and a select-all when the reader can plan', () => {
    list({ canSelect: true })
    expect(screen.getAllByRole('checkbox')).toHaveLength(ROWS.length + 1)
    expect(screen.getByRole('checkbox', { name: 'Select all shown tasks' })).toBeTruthy()
  })

  it('counts the selection, selects all shown only, and clears', async () => {
    list({ canSelect: true })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select W-1' }))
    expect(screen.getByRole('status').textContent).toContain('1 selected')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), {
      target: { value: 'child' },
    })
    await waitFor(() => expect(titles()).toHaveLength(2))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all shown tasks' }))
    expect(screen.getByRole('status').textContent).toContain('3 selected')

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByRole('status').textContent).not.toContain('selected')
  })
})
