import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksTable } from '@/components/tasks/tasks-table'
import type { OpenSprint, WorkBoard } from '@/lib/data/tasks'
import { SCHEDULE_DENIAL } from '@/lib/roles'
import { backlogTask } from './support/backlog-fixtures'

/** The Tasks page's Move to sprint for a User scheduler (TB-8, TB-10). */
const move = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/sprint-planning-actions', () => ({ moveTasksToSprint: move }))

const BOARDS: WorkBoard[] = [{ id: 'b-1', name: 'Engineering', sprintsEnabled: true }]
const SPRINTS: Record<string, OpenSprint[]> = {
  'b-1': [{ id: 's-1', name: 'Sprint 1', state: 'Active' }],
}
const ROWS = [
  backlogTask('1', { itemKey: 'T-1', authorUserId: 'u-me' }),
  backlogTask('2', { itemKey: 'T-2', authorUserId: 'u-ada' }),
]

const table = () =>
  render(
    <TasksTable
      rows={ROWS}
      total={ROWS.length}
      boards={BOARDS}
      sprints={SPRINTS}
      scheduler={{ userId: 'u-me', isAdmin: false }}
      emptyHeading="Nothing"
      emptyText="None."
    />,
  )
const pick = (key: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: `Select ${key}` }))
const moveButton = () => screen.getByRole('button', { name: 'Move to sprint' })

beforeEach(() => {
  move.mockReset().mockResolvedValue({ error: null })
})

describe('Tasks page Move to sprint for a User', () => {
  it('moves tasks they wrote', () => {
    table()
    pick('T-1')

    expect(moveButton().getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(moveButton())
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-1', ['1'])
  })

  it('disables it with the stated reason when the selection holds a task they did not write', () => {
    table()
    pick('T-1')
    pick('T-2')

    const button = moveButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(
      document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe(SCHEDULE_DENIAL)
    fireEvent.click(button)
    expect(move).not.toHaveBeenCalled()
  })

  it('re-enables it when the foreign task is unticked', () => {
    table()
    pick('T-1')
    pick('T-2')
    pick('T-2')

    expect(moveButton().getAttribute('aria-disabled')).toBeNull()
  })
})
