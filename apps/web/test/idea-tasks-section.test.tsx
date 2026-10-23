import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksCompletePrompt, TasksSection } from '@/components/ideas/idea-tasks'
import { addBoardTask, moveIdea, removeBoardTask } from '@/lib/server/idea-actions'
import type { BoardTask, IdeaTasks } from '@/lib/types'
import { stubDialogMethods } from './support/dialog'

/**
 * The drawer's Tasks section and completion prompt (slice 299, comp U screen 4): the rows and the
 * "N of M done" count, + Add task, the delete confirm, "Move back" for a parent past the lane, and
 * the Move / Not yet prompt. The server actions are the boundary.
 */
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  addBoardTask: vi.fn(),
  moveIdea: vi.fn(),
  removeBoardTask: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/server/sprint-planning-actions', () => ({ moveTasksToSprint: vi.fn() }))

stubDialogMethods()

const add = vi.mocked(addBoardTask)
const move = vi.mocked(moveIdea)
const remove = vi.mocked(removeBoardTask)

const PARENT = { id: 'p-1', boardId: 'b-1', title: 'Ship the thing', itemKey: 'IDEA-7' }
const LANES = [
  { id: 'l-open', name: 'Open', color: '#111111', isFinal: false },
  { id: 'l-doing', name: 'Doing', color: '#333333', isFinal: false },
  { id: 'l-done', name: 'Done', color: '#222222', isFinal: true },
  { id: 'l-gone', name: 'Abandoned', color: '#444444', isFinal: true },
]

const task = (id: string, over: Partial<BoardTask> = {}): BoardTask => ({
  id,
  itemKey: `IMPL-${id}`,
  title: `Task ${id}`,
  statusId: 'l-open',
  statusName: 'Open',
  isFinal: false,
  assignees: [],
  blockedBy: [],
  autoCreated: false,
  ...over,
})
const done = (id: string) => task(id, { statusId: 'l-done', statusName: 'Done', isFinal: true })

function tasksOf(tasks: BoardTask[], over: Partial<IdeaTasks> = {}): IdeaTasks {
  return {
    tasks,
    referenced: { id: 'b-impl', name: 'Implementation', lanes: LANES },
    referenceLane: { id: 'l-ref', name: 'Implementation lane' },
    inLane: true,
    nextLane: { id: 'l-next', name: 'Shipped' },
    canMove: true,
    adding: { members: [{ id: 'u-1', name: 'Ada Lovelace' }], tags: [] },
    scheduling: null,
    ...over,
  }
}

beforeEach(() => {
  add.mockReset().mockResolvedValue({ error: null })
  move.mockReset().mockResolvedValue({ error: null })
  remove.mockReset().mockResolvedValue({ error: null })
})

describe('TasksSection: rows', () => {
  it('counts the tasks done of the total and lists them in the order given', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([done('1'), task('2'), task('3')])} />)

    expect(screen.getByText('1 of 3 done')).toBeTruthy()
    const titles = screen.getAllByRole('link').map((link) => link.textContent)
    expect(titles).toEqual(['Task 1', 'Task 2', 'Task 3'])
  })

  it('opens a task on its own board and marks done and open ticks', () => {
    render(
      <TasksSection parent={PARENT} tasks={tasksOf([done('1'), task('2')], { canMove: false })} />,
    )

    expect(screen.getByRole('link', { name: 'Task 1' }).getAttribute('href')).toBe(
      '/boards/b-impl?idea=1',
    )
    expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: 'Open' })).toHaveLength(1)
  })

  it('says there are no tasks yet for an empty list', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([])} />)

    expect(screen.getByText('0 of 0 done')).toBeTruthy()
    expect(screen.getByText('No tasks yet.')).toBeTruthy()
  })

  it('badges a task blocked while it is in the first lane, and not once it has left', () => {
    const blockedBy = [{ ideaId: 'x', itemKey: 'IMPL-9', isFinal: false }]
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([
          task('1', { blockedBy }),
          task('2', { blockedBy, statusId: 'l-done', statusName: 'Done' }),
        ])}
      />,
    )

    expect(screen.getAllByText('blocked by IMPL-9')).toHaveLength(1)
  })

  it('tags only an auto-created task, quietly, beside its key', () => {
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([task('1', { autoCreated: true }), task('2'), task('3')])}
      />,
    )

    const tags = screen.getAllByText('auto-created')
    expect(tags).toHaveLength(1)
    expect(tags[0]?.parentElement?.textContent).toContain('IMPL-1')
    expect(tags[0]?.parentElement?.textContent).not.toContain('IMPL-2')
  })

  it('keeps the auto-created tag on a task that is done or blocked', () => {
    const blockedBy = [{ ideaId: 'x', itemKey: 'IMPL-9', isFinal: false }]
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([
          { ...done('1'), autoCreated: true },
          task('2', { autoCreated: true, blockedBy }),
        ])}
      />,
    )

    expect(screen.getAllByText('auto-created')).toHaveLength(2)
    expect(screen.getByText('blocked by IMPL-9')).toBeTruthy()
  })

  it('hides Add task and the delete buttons from a reader who may not edit', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1')], { adding: null })} />)

    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete task/ })).toBeNull()
    expect(screen.getByText('Task 1')).toBeTruthy()
  })
})

describe('TasksSection: ticking a task', () => {
  it('checks an open task into the first final lane of its board', async () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1')])} />)
    const tick = screen.getByRole('button', { name: 'Task 1 done' })
    expect(tick.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(tick)

    await waitFor(() => expect(move).toHaveBeenCalledTimes(1))
    const form = move.mock.calls[0]?.[1] as FormData
    expect(form.get('ideaId')).toBe('1')
    expect(form.get('boardId')).toBe('b-impl')
    expect(form.get('statusId')).toBe('l-done')
  })

  it('unchecks a done task into the last lane that is not final', async () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([done('1')])} />)
    const tick = screen.getByRole('button', { name: 'Task 1 done' })
    expect(tick.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(tick)

    await waitFor(() => expect(move).toHaveBeenCalledTimes(1))
    const form = move.mock.calls[0]?.[1] as FormData
    expect(form.get('ideaId')).toBe('1')
    expect(form.get('statusId')).toBe('l-doing')
  })

  it('shows a refusal on the row and leaves the tick as it was', async () => {
    move.mockResolvedValue({ error: 'IMPL-1 is blocked by IMPL-9.' })
    const blockedBy = [{ ideaId: 'x', itemKey: 'IMPL-9', isFinal: false }]
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1', { blockedBy }), task('2')])} />)

    fireEvent.click(screen.getByRole('button', { name: 'Task 1 done' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('IMPL-1 is blocked by IMPL-9.')
    expect(alert.closest('li')?.textContent).toContain('Task 1')
    const form = move.mock.calls[0]?.[1] as FormData
    expect(form.get('blockers')).toBe('1')
    const tick = await screen.findByRole('button', { name: 'Task 1 done' })
    expect(tick.getAttribute('aria-pressed')).toBe('false')
    expect(tick.getAttribute('aria-describedby')).toBe(alert.id)
    await waitFor(() => expect((tick as HTMLButtonElement).disabled).toBe(false))
  })

  it('keeps the read-only circle for a reader who may not move', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1')], { canMove: false })} />)

    expect(screen.queryByRole('button', { name: /Task 1 done/ })).toBeNull()
    expect(screen.getByRole('img', { name: 'Open' })).toBeTruthy()
  })
})

describe('TasksSection: adding', () => {
  const open = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    return screen.getByRole('form', { name: 'Add task' })
  }

  it('names the board and first lane the task will start in', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([])} />)
    const form = open()

    expect(
      within(form).getByText(/start in the first lane of the Implementation board \(Open\)/),
    ).toBeTruthy()
  })

  it('refuses a blank title without calling the server', async () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([])} />)
    const form = open()

    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Title is required.')).toBeTruthy()
    expect(add).not.toHaveBeenCalled()
  })

  it('posts the trimmed title to the referenced board and closes the form', async () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([])} />)
    const form = open()

    fireEvent.change(within(form).getByLabelText(/Title/), { target: { value: '  Write it  ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith('p-1', 'b-1', 'b-impl', {
        title: 'Write it',
        description: '',
        assigneeUserIds: [],
        tagNames: [],
      }),
    )
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add task' })).toBeNull())
  })

  it('keeps the form open and shows the refusal when the server refuses', async () => {
    add.mockResolvedValue({ error: 'The board is archived.' })
    render(<TasksSection parent={PARENT} tasks={tasksOf([])} />)
    const form = open()

    fireEvent.change(within(form).getByLabelText(/Title/), { target: { value: 'Write it' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    expect((await within(form).findByRole('alert')).textContent).toBe('The board is archived.')
    expect(screen.getByRole('form', { name: 'Add task' })).toBeTruthy()
  })

  it('closes on Cancel without calling the server', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([])} />)
    const form = open()

    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('form', { name: 'Add task' })).toBeNull()
    expect(add).not.toHaveBeenCalled()
  })
})

describe('TasksSection: Move back', () => {
  const past = () => tasksOf([task('1')], { inLane: false })

  it('asks before adding when the parent is past the reference lane, and opens no form', () => {
    render(<TasksSection parent={PARENT} tasks={past()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(screen.getByText('Move back to Implementation lane?')).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Add task' })).toBeNull()
  })

  it('moves the parent to the reference lane, then opens the add form once the page shows it there', async () => {
    const { rerender } = render(<TasksSection parent={PARENT} tasks={past()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    fireEvent.click(screen.getByRole('button', { name: 'Move back' }))

    await waitFor(() => expect(move).toHaveBeenCalledTimes(1))
    const form = move.mock.calls[0]?.[1] as FormData
    expect(form.get('ideaId')).toBe('p-1')
    expect(form.get('boardId')).toBe('b-1')
    expect(form.get('statusId')).toBe('l-ref')
    // The action's revalidation hands the section a parent that is now in the lane.
    rerender(<TasksSection parent={PARENT} tasks={tasksOf([task('1')])} />)
    expect(await screen.findByRole('form', { name: 'Add task' })).toBeTruthy()
  })

  it('stays on the dialog with the refusal, and opens no form, when the move is refused', async () => {
    move.mockResolvedValue({ error: 'Add Effort first.' })
    render(<TasksSection parent={PARENT} tasks={past()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    fireEvent.click(screen.getByRole('button', { name: 'Move back' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Add Effort first.')
    expect(screen.queryByRole('form', { name: 'Add task' })).toBeNull()
  })

  it('cancels without moving', () => {
    render(<TasksSection parent={PARENT} tasks={past()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(move).not.toHaveBeenCalled()
    expect(screen.queryByText('Move back to Implementation lane?')).toBeNull()
  })
})

describe('TasksSection: deleting', () => {
  const ask = () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1'), task('2')])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task IMPL-1' }))
  }

  it('confirms by name before deleting anything', () => {
    ask()

    expect(screen.getByText('Delete task IMPL-1?')).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes the task through the parent and the task board', async () => {
    ask()

    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith('p-1', '1', 'b-1', 'b-impl'))
    await waitFor(() => expect(screen.queryByText('Delete task IMPL-1?')).toBeNull())
  })

  it('keeps the dialog open with the refusal when the delete fails', async () => {
    remove.mockResolvedValue({ error: 'You are not allowed to edit ideas.' })
    ask()

    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'You are not allowed to edit ideas.',
    )
    expect(screen.getByText('Delete task IMPL-1?')).toBeTruthy()
  })

  it('names a task with no key by its title', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1', { itemKey: null })])} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete task Task 1' }))

    expect(screen.getByText('Delete task ‘Task 1’?')).toBeTruthy()
  })
})

describe('TasksCompletePrompt', () => {
  it('offers the move when every task is final', () => {
    render(<TasksCompletePrompt parent={PARENT} tasks={tasksOf([done('1'), done('2')])} />)

    expect(screen.getByText('All 2 tasks are complete.')).toBeTruthy()
    expect(screen.getByText(/Move to Shipped\?/)).toBeTruthy()
  })

  it.each([
    ['a task is still open', tasksOf([done('1'), task('2')])],
    ['there are no tasks', tasksOf([])],
    ['the parent is already past the lane', tasksOf([done('1')], { inLane: false })],
    ['the reader may not move it', tasksOf([done('1')], { canMove: false })],
    ['there is no lane after it', tasksOf([done('1')], { nextLane: null })],
  ])('is absent when %s', (_why, tasks) => {
    const { container } = render(<TasksCompletePrompt parent={PARENT} tasks={tasks} />)

    expect(container.firstChild).toBeNull()
  })

  it('moves the parent to the next lane only when Move is pressed', async () => {
    render(<TasksCompletePrompt parent={PARENT} tasks={tasksOf([done('1')])} />)
    expect(move).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Move' }))

    await waitFor(() => expect(move).toHaveBeenCalledTimes(1))
    const form = move.mock.calls[0]?.[1] as FormData
    expect(form.get('statusId')).toBe('l-next')
    expect(form.get('ideaId')).toBe('p-1')
  })

  it('shows the refusal and stays when the move is refused', async () => {
    move.mockResolvedValue({ error: 'Waiting on 1 task.' })
    render(<TasksCompletePrompt parent={PARENT} tasks={tasksOf([done('1')])} />)

    fireEvent.click(screen.getByRole('button', { name: 'Move' }))

    expect(await screen.findByText('Waiting on 1 task.')).toBeTruthy()
    // The refusal can render a tick before the pending label clears, so wait for "Move" too.
    expect(await screen.findByRole('button', { name: 'Move' })).toBeTruthy()
  })

  it('goes away on Not yet without moving', () => {
    const { container } = render(
      <TasksCompletePrompt parent={PARENT} tasks={tasksOf([done('1')])} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }))

    expect(container.firstChild).toBeNull()
    expect(move).not.toHaveBeenCalled()
  })
})
