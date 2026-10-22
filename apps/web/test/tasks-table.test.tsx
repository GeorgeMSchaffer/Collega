import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksTable } from '@/components/tasks/tasks-table'
import type { OpenSprint, WorkBoard } from '@/lib/data/tasks'
import type { Idea } from '@/lib/types'

/**
 * The Tasks page's list (TB-8, TB-10): selection, the bulk bar and its "Move to sprint" (enabled
 * for one board only, otherwise focusable with the reason), the honesty line, empty states and who
 * gets controls. The server action is the boundary.
 */
const move = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/sprint-planning-actions', () => ({ moveTasksToSprint: move }))

const BOARDS: WorkBoard[] = [
  { id: 'b-1', name: 'Engineering', sprintsEnabled: true },
  { id: 'b-2', name: 'Platform', sprintsEnabled: true },
]
const SPRINTS: Record<string, OpenSprint[]> = {
  'b-1': [
    { id: 's-1', name: 'Sprint 1', state: 'Planned' },
    { id: 's-2', name: 'Sprint 2', state: 'Active' },
  ],
  'b-2': [{ id: 's-3', name: 'Sprint 3', state: 'Planned' }],
}

const idea = (id: string, boardId: string, over: Partial<Idea> = {}): Idea => ({
  id,
  boardId,
  authorUserId: 'u',
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
  itemKey: `T-${id}`,
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
  ...over,
})
const ROWS = [
  idea('1', 'b-1'),
  idea('2', 'b-1', {
    sprint: { id: 's-1', name: 'Sprint 1' },
    parentIdeaId: 'p',
    parentItemKey: 'IDEA-7',
  }),
  idea('3', 'b-2'),
]

function table(over: Partial<Parameters<typeof TasksTable>[0]> = {}) {
  render(
    <TasksTable
      rows={ROWS}
      total={ROWS.length}
      boards={BOARDS}
      sprints={SPRINTS}
      canPlan
      emptyHeading="Nothing waiting"
      emptyText="All planned."
      {...over}
    />,
  )
}
const pick = (key: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: `Select ${key}` }))
const moveButton = () => screen.getByRole('button', { name: 'Move to sprint' })

beforeEach(() => {
  move.mockReset()
  move.mockResolvedValue({ error: null })
})

describe('rows', () => {
  it('names each task’s board, parent or standalone, and sprint or Backlog', () => {
    table()
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0] as HTMLElement).getByText('Engineering')).toBeTruthy()
    expect(within(rows[0] as HTMLElement).getByText('standalone')).toBeTruthy()
    expect(within(rows[0] as HTMLElement).getByText('Backlog')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('Sprint 1')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('IDEA-7')).toBeTruthy()
    expect(within(rows[2] as HTMLElement).getByText('Platform')).toBeTruthy()
  })

  it('links each title to the task open on its own board', () => {
    table()
    expect(screen.getByRole('link', { name: 'Task 3' }).getAttribute('href')).toBe(
      '/boards/b-2?tab=board&idea=3',
    )
  })
})

describe('counts and empty states', () => {
  it('says "first N of M" only when the API holds more than it sent', () => {
    table({ total: 250 })
    expect(screen.getByRole('status').textContent).toContain('first 3 of 250')
  })

  it('says only the count when everything is shown', () => {
    table()
    expect(screen.getByRole('status').textContent).toBe('3 tasks')
  })

  it('uses the singular for one task', () => {
    table({ rows: [ROWS[0] as Idea], total: 1 })
    expect(screen.getByRole('status').textContent).toBe('1 task')
  })

  it('shows the tab’s empty state instead of a table when there are no rows', () => {
    table({ rows: [], total: 0 })
    expect(screen.getByText('Nothing waiting')).toBeTruthy()
    expect(screen.getByText('All planned.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move to sprint' })).toBeNull()
  })
})

describe('selection and Move to sprint', () => {
  it('starts with nothing selected and the button disabled for want of a selection', () => {
    table()
    expect(screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(
      true,
    )
    expect(moveButton().getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Select tasks to move.')).toBeTruthy()
  })

  it('stays focusable and points at its reason when disabled', () => {
    table()
    const button = moveButton()
    button.focus()
    expect(document.activeElement).toBe(button)
    expect((button as HTMLButtonElement).disabled).toBe(false)
    const why = document.getElementById(button.getAttribute('aria-describedby') ?? '')
    expect(why?.textContent).toBe('Select tasks to move.')
  })

  it('enables the action for tasks from one board and offers that board’s open sprints', () => {
    table()
    pick('T-1')
    pick('T-2')
    expect(screen.getByRole('status').textContent).toContain('2 selected')
    expect(moveButton().getAttribute('aria-disabled')).toBeNull()
    const select = screen.getByLabelText('Sprint on Engineering') as HTMLSelectElement
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'Sprint 1 (Planned)',
      'Sprint 2 (Active)',
    ])
  })

  it('disables the action with the stated reason once the selection spans two boards', () => {
    table()
    pick('T-1')
    pick('T-3')
    expect(moveButton().getAttribute('aria-disabled')).toBe('true')
    expect(
      screen.getByText(/Selected tasks are on 2 boards\. A sprint belongs to one board/),
    ).toBeTruthy()
    fireEvent.click(moveButton())
    expect(move).not.toHaveBeenCalled()
  })

  it('re-enables the action when the offending board’s task is unticked', () => {
    table()
    pick('T-1')
    pick('T-3')
    pick('T-3')
    expect(moveButton().getAttribute('aria-disabled')).toBeNull()
  })

  it('moves the selected ids into the chosen sprint on their board, then clears and confirms', async () => {
    table()
    pick('T-1')
    pick('T-2')
    fireEvent.change(screen.getByLabelText('Sprint on Engineering'), { target: { value: 's-2' } })
    fireEvent.click(moveButton())
    await waitFor(() => expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-2', ['1', '2']))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Moved 2 tasks to Sprint 2.'),
    )
    expect(screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(
      true,
    )
  })

  it('defaults to the board’s first open sprint when none is picked', async () => {
    table()
    pick('T-3')
    fireEvent.click(moveButton())
    await waitFor(() => expect(move).toHaveBeenCalledExactlyOnceWith('b-2', 's-3', ['3']))
  })

  it('shows the refusal in words, keeps the selection and reports no move', async () => {
    move.mockResolvedValue({ error: 'T-1 is on another board.' })
    table()
    pick('T-1')
    fireEvent.click(moveButton())
    expect(await screen.findByText('T-1 is on another board.')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'Select T-1' }) as HTMLInputElement).checked).toBe(
      true,
    )
    expect(screen.getByRole('status').textContent).not.toContain('Moved')
  })

  it('selects and clears every shown task from the header box and Clear selection', () => {
    table()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all shown tasks' }))
    expect(screen.getByRole('status').textContent).toContain('3 selected')
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByRole('status').textContent).toBe('3 tasks')
  })

  it('explains a board with sprints turned off', () => {
    table({
      boards: [{ id: 'b-1', name: 'Engineering', sprintsEnabled: false }, BOARDS[1] as WorkBoard],
    })
    pick('T-1')
    expect(screen.getByText('Sprints are turned off on Engineering.')).toBeTruthy()
  })

  it('explains a board with no open sprint', () => {
    table({ sprints: { 'b-1': [], 'b-2': [] } })
    pick('T-1')
    expect(screen.getByText(/Engineering has no Planned or Active sprint/)).toBeTruthy()
  })
})

describe('without planning rights (User, Read Only)', () => {
  it('shows the rows with no checkboxes, no Move to sprint and no selection controls', () => {
    table({ canPlan: false })
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Move to sprint' })).toBeNull()
    expect(screen.queryByText('Select tasks to move.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()
  })
})
