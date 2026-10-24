import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BacklogList } from '@/components/boards/backlog-list'
import { SCHEDULE_DENIAL } from '@/lib/roles'
import { moveTasksToSprint } from '@/lib/server/sprint-planning-actions'
import type { Sprint } from '@/lib/types'
import { backlogTask } from './support/backlog-fixtures'

/**
 * The Backlog selection bar for a User scheduler (TB-10): a selection holding a task they did not
 * write disables Add with the stated reason; one of their own enables it; and creating a sprint
 * stays Org Admin only.
 */
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  moveTasksToSprint: vi.fn(),
  createBoardSprint: vi.fn(),
}))
const add = vi.mocked(moveTasksToSprint)

const USER = { userId: 'u-me', isAdmin: false }
const ADMIN = { userId: 'u-admin', isAdmin: true }
const ACTIVE: Sprint = {
  id: 's-a',
  name: 'Sprint 8',
  goal: null,
  startsOn: '',
  endsOn: '',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  window: '',
  state: 'Active',
  issueCount: 0,
  doneCount: 0,
}
const ROWS = [
  backlogTask('1', { itemKey: 'W-1', authorUserId: 'u-me' }),
  backlogTask('2', { itemKey: 'W-2', authorUserId: 'u-me' }),
  backlogTask('3', { itemKey: 'W-3', authorUserId: 'u-ada' }),
]

const list = (scheduler = USER) =>
  render(
    <BacklogList
      boardId="b-1"
      boardName="Implementation"
      rows={ROWS}
      total={ROWS.length}
      lanes={[{ id: 'todo', name: 'To do', color: '#111111', isFinal: false }]}
      scheduler={scheduler}
      newTaskHref={null}
      sprints={[ACTIVE]}
      members={[]}
    />,
  )
const pick = (key: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: `Select ${key}` }))
const bar = () => within(screen.getByRole('region', { name: 'Selected tasks' }))
const addButton = () => bar().getByRole('button', { name: /^Add to Sprint 8/ })

beforeEach(() => {
  add.mockReset().mockResolvedValue({ error: null })
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Backlog selection bar for a User', () => {
  it('enables Add when every ticked task is theirs, and sends them', () => {
    list()
    pick('W-1')
    pick('W-2')

    expect(addButton().getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(addButton())
    expect(add).toHaveBeenCalledExactlyOnceWith('b-1', 's-a', ['1', '2'])
    expect(screen.queryByText(SCHEDULE_DENIAL)).toBeNull()
  })

  it('disables Add with the reason beside it when the selection holds a task they did not write, and sends nothing', () => {
    list()
    pick('W-1')
    pick('W-3')

    const button = addButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    const why = document.getElementById(button.getAttribute('aria-describedby') ?? '')
    expect(why?.textContent).toBe(SCHEDULE_DENIAL)
    fireEvent.click(button)
    expect(add).not.toHaveBeenCalled()
  })

  it('lifts the refusal again once the foreign task is unticked', () => {
    list()
    pick('W-1')
    pick('W-3')
    pick('W-3')

    expect(addButton().getAttribute('aria-disabled')).toBeNull()
    expect(screen.queryByText(SCHEDULE_DENIAL)).toBeNull()
  })

  it('never offers "Add to new sprint…" or any create option', () => {
    list()
    pick('W-1')

    expect(screen.queryByRole('button', { name: 'Add to new sprint…' })).toBeNull()
    expect(screen.queryByRole('button', { name: /New sprint/ })).toBeNull()
  })

  it('offers an Org Admin "Add to new sprint…" and no refusal for the same selection', () => {
    list(ADMIN)
    pick('W-1')
    pick('W-3')

    expect(bar().getByRole('button', { name: 'Add to new sprint…' })).toBeTruthy()
    expect(addButton().getAttribute('aria-disabled')).toBeNull()
    expect(screen.queryByText(SCHEDULE_DENIAL)).toBeNull()
  })
})
