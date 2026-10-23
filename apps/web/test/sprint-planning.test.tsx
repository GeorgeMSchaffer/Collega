import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SprintPlanning } from '@/components/boards/sprint-planning'
import {
  addSprintTask,
  moveTasksToSprint,
  startBoardSprint,
} from '@/lib/server/sprint-planning-actions'
import type { Sprint } from '@/lib/types'
import { TASKS, task } from './support/backlog-fixtures'
import { stubDialogMethods } from './support/dialog'

const ADMIN = { userId: 'u-admin', isAdmin: true }

/**
 * The sprint planning page body (TB-5, TB-10, comp W screen 4): the two columns, search, what Add,
 * Remove, the inline new-task line and Start sprint each send, and who sees which control. The
 * server actions are the boundary; nothing is asserted about their internals here.
 */
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  moveTasksToSprint: vi.fn(),
  addSprintTask: vi.fn(),
  startBoardSprint: vi.fn(),
}))
const move = vi.mocked(moveTasksToSprint)
const addNew = vi.mocked(addSprintTask)
const start = vi.mocked(startBoardSprint)
stubDialogMethods()

const sprint = (over: Partial<Sprint> = {}): Sprint => ({
  id: 's-9',
  name: 'Sprint 9',
  goal: 'Ship the thing',
  startsOn: '',
  endsOn: '',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  window: '',
  state: 'Planned',
  issueCount: 0,
  doneCount: 0,
  ...over,
})
const LANES = [{ id: 'l-1', name: 'To do', color: '#111111', isFinal: false }]
const IN_SPRINT = [
  task('7', { title: 'Already in', itemKey: 'W-7', statusName: 'Doing' }),
  task('8', { title: 'Also in', itemKey: 'W-8' }),
]

const planning = (over: Partial<Parameters<typeof SprintPlanning>[0]> = {}) =>
  render(
    <SprintPlanning
      boardId="b-1"
      organizationId="org-1"
      sprint={sprint()}
      backlog={TASKS}
      backlogTotal={TASKS.length}
      inSprint={IN_SPRINT}
      lanes={LANES}
      scheduler={ADMIN}
      {...over}
    />,
  )
const click = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el)
  })
}
const backlogCol = () => screen.getByRole('region', { name: 'Backlog' })
const sprintCol = () => screen.getByRole('region', { name: 'In this sprint' })

beforeEach(() => {
  move.mockReset().mockResolvedValue({ error: null })
  addNew.mockReset().mockResolvedValue({ error: null })
  start.mockReset().mockResolvedValue({ error: null })
})

describe('sprint planning columns', () => {
  it('lists the Backlog on one side and the sprint’s tasks on the other, with counts', () => {
    planning()
    expect(within(backlogCol()).getAllByRole('listitem')).toHaveLength(4)
    expect(within(backlogCol()).getByText('4 unassigned')).toBeTruthy()
    expect(within(sprintCol()).getAllByRole('listitem')).toHaveLength(2)
    expect(within(sprintCol()).getByText('2 tasks')).toBeTruthy()
    expect(screen.getByText('Ship the thing')).toBeTruthy()
  })

  it('shows a sprint task’s lane and marks standalone cards', () => {
    planning()
    expect(within(sprintCol()).getByText('Doing')).toBeTruthy()
    expect(within(backlogCol()).getAllByText('standalone')).toHaveLength(1)
  })

  it('says so when the Backlog or the sprint is empty', () => {
    planning({ backlog: [], backlogTotal: 0, inSprint: [] })
    expect(screen.getByText('Nothing waiting in the Backlog.')).toBeTruthy()
    expect(screen.getByText('No tasks in this sprint yet.')).toBeTruthy()
  })

  it('filters the Backlog by title, key or parent key, and says when nothing matches', () => {
    planning()
    const search = screen.getByLabelText('Search the Backlog')
    fireEvent.change(search, { target: { value: 'alpha' } })
    expect(within(backlogCol()).getAllByRole('listitem')).toHaveLength(2)
    fireEvent.change(search, { target: { value: 'idea-8' } })
    expect(within(backlogCol()).getAllByRole('listitem')).toHaveLength(1)
    fireEvent.change(search, { target: { value: 'W-1' } })
    expect(within(backlogCol()).getByText('Standalone chore')).toBeTruthy()
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText('No task matches.')).toBeTruthy()
  })

  it('leaves the sprint column alone when searching', () => {
    planning()
    fireEvent.change(screen.getByLabelText('Search the Backlog'), { target: { value: 'zzz' } })
    expect(within(sprintCol()).getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('sprint planning Add and Remove', () => {
  it('Add sends the task with the sprint’s id', async () => {
    planning()
    await click(screen.getByRole('button', { name: 'Add W-2 to Sprint 9' }))
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-9', ['2'])
    expect(screen.getByText('Added W-2 to Sprint 9.')).toBeTruthy()
  })

  it('Remove sends a null sprint, which returns the task to the Backlog', async () => {
    planning()
    await click(screen.getByRole('button', { name: 'Remove W-7 from Sprint 9' }))
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', null, ['7'])
    expect(screen.getByText('W-7 is back in the Backlog.')).toBeTruthy()
  })

  it('shows the refusal as it came and no success notice when a move fails', async () => {
    move.mockResolvedValue({ error: 'W-2 is on another board.' })
    planning()
    await click(screen.getByRole('button', { name: 'Add W-2 to Sprint 9' }))
    expect(screen.getByRole('alert').textContent).toBe('W-2 is on another board.')
    expect(screen.queryByText(/Added W-2/)).toBeNull()
  })

  it('clears an earlier error when the next move is tried', async () => {
    move.mockResolvedValueOnce({ error: 'nope' })
    planning()
    await click(screen.getByRole('button', { name: 'Add W-2 to Sprint 9' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Add W-3 to Sprint 9' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('sprint planning inline new task', () => {
  const field = () => screen.getByLabelText('New task title') as HTMLInputElement
  const submit = () => screen.getByRole('button', { name: 'Add task' })

  it('sends the trimmed title with the board and sprint, then clears the line', async () => {
    planning()
    fireEvent.change(field(), { target: { value: '  Write docs  ' } })
    await click(submit())
    expect(addNew).toHaveBeenCalledExactlyOnceWith('b-1', 's-9', 'Write docs')
    expect(field().value).toBe('')
    expect(screen.getByText('Added “Write docs” to Sprint 9.')).toBeTruthy()
  })

  it('sends nothing for a blank title, and the button stays disabled', () => {
    planning()
    expect((submit() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field(), { target: { value: '   ' } })
    expect((submit() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(field().closest('form') as HTMLFormElement)
    expect(addNew).not.toHaveBeenCalled()
  })

  it('keeps the typed title and shows the refusal when the API says no', async () => {
    addNew.mockResolvedValue({ error: 'Title is too long.' })
    planning()
    fireEvent.change(field(), { target: { value: 'Keep me' } })
    await click(submit())
    expect(field().value).toBe('Keep me')
    expect(screen.getByRole('alert').textContent).toBe('Title is too long.')
  })

  it('caps the title at 150 characters', () => {
    planning()
    expect(field().maxLength).toBe(150)
  })
})

describe('sprint planning Start sprint', () => {
  const startButton = () => screen.queryByRole('button', { name: 'Start sprint' })
  const confirm = async () => {
    await click(startButton() as HTMLElement)
    const dialog = screen.getByRole('alertdialog', { name: 'Start this sprint?' })
    await click(within(dialog).getByRole('button', { name: 'Start sprint' }))
  }

  it('asks first, naming the sprint and its task count, and starts nothing until confirmed', async () => {
    planning()
    await click(startButton() as HTMLElement)
    const dialog = screen.getByRole('alertdialog', { name: 'Start this sprint?' })
    expect(dialog.textContent).toContain('“Sprint 9” becomes the running sprint with 2 tasks.')
    expect(start).not.toHaveBeenCalled()
  })

  it('cancelling the confirm starts nothing', async () => {
    planning()
    await click(startButton() as HTMLElement)
    await click(screen.getByRole('button', { name: 'Cancel' }))
    expect(start).not.toHaveBeenCalled()
  })

  it('confirming starts the sprint with the board, organization and sprint ids', async () => {
    planning()
    await confirm()
    expect(start).toHaveBeenCalledExactlyOnceWith('b-1', 'org-1', 's-9')
    expect(screen.getByText('Sprint 9 started.')).toBeTruthy()
  })

  it('shows the refusal when starting fails', async () => {
    start.mockResolvedValue({ error: 'Another sprint is already active.' })
    planning()
    await confirm()
    expect(screen.getByRole('alert').textContent).toBe('Another sprint is already active.')
    expect(screen.queryByText('Sprint 9 started.')).toBeNull()
  })

  it('is offered for a Planned sprint only', () => {
    const { unmount } = planning({ sprint: sprint({ state: 'Active' }) })
    expect(startButton()).toBeNull()
    unmount()
    planning({ sprint: sprint({ state: 'Completed' }) })
    expect(startButton()).toBeNull()
  })

  it('needs an organization to start in, so a Site Admin context has no button', () => {
    planning({ organizationId: null })
    expect(startButton()).toBeNull()
  })
})

describe('sprint planning roles and states', () => {
  it('an Active sprint is still editable: Add, Remove and the new-task line are there', () => {
    planning({ sprint: sprint({ state: 'Active' }) })
    expect(screen.getAllByRole('button', { name: /^Add W-/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2)
    expect(screen.getByLabelText('New task title')).toBeTruthy()
  })

  it('a Completed sprint is a read-only record with no controls and no Backlog column', () => {
    planning({ sprint: sprint({ state: 'Completed' }), backlog: [], backlogTotal: 0 })
    expect(screen.getByText(/This sprint is completed/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Backlog' })).toBeNull()
    expect(screen.queryByLabelText('Search the Backlog')).toBeNull()
    expect(screen.queryByLabelText('New task title')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(within(sprintCol()).getAllByRole('listitem')).toHaveLength(2)
  })

  it('a reader who cannot plan sees the sprint’s tasks and no controls at all', () => {
    planning({ scheduler: null, backlog: [], backlogTotal: 0 })
    expect(within(sprintCol()).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('region', { name: 'Backlog' })).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByLabelText('New task title')).toBeNull()
    expect(screen.queryByText(/This sprint is completed/)).toBeNull()
  })

  it('links each task to its card on the board', () => {
    planning()
    expect(screen.getByRole('link', { name: 'Already in' }).getAttribute('href')).toBe(
      '/boards/b-1?tab=board&idea=7',
    )
  })
})
