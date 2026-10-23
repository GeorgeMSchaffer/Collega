import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksSection } from '@/components/ideas/idea-tasks'
import { createBoardSprint, moveTasksToSprint } from '@/lib/server/sprint-planning-actions'
import type { BoardTask, IdeaTasks } from '@/lib/types'
import { TASKS } from './support/backlog-fixtures'
import { stubDialogMethods } from './support/dialog'

/**
 * "Schedule…" in the parent idea's Tasks section (slice 336, TB-9): the sprint shown per task, who
 * is offered the control, what the dialog lists, and the two ways out (an existing sprint, or the
 * create drawer with the task ticked). The server actions are the boundary; the drawer is real.
 */
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('@/lib/server/idea-actions', () => ({
  addBoardTask: vi.fn(),
  moveIdea: vi.fn(),
  removeBoardTask: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  moveTasksToSprint: vi.fn(),
  createBoardSprint: vi.fn(),
}))

stubDialogMethods()

const move = vi.mocked(moveTasksToSprint)
const create = vi.mocked(createBoardSprint)

const PARENT = { id: 'p-7', boardId: 'b-1', title: 'Ship the thing', itemKey: 'IDEA-7' }
const LANES = [
  { id: 'l-open', name: 'Open', color: '#111111', isFinal: false },
  { id: 'l-done', name: 'Done', color: '#222222', isFinal: true },
]
const IN_SPRINT = { id: 's-act', name: 'Sprint 7' }

const task = (id: string, over: Partial<BoardTask> = {}): BoardTask => ({
  id,
  itemKey: `W-${id}`,
  title: `Task ${id}`,
  statusId: 'l-open',
  statusName: 'Open',
  isFinal: false,
  assignees: [],
  blockedBy: [],
  autoCreated: false,
  mayEdit: true,
  ...over,
})

const SPRINTS: { id: string; name: string; state: 'Planned' | 'Active' }[] = [
  { id: 's-plan', name: 'Sprint 8', state: 'Planned' },
  { id: 's-act', name: 'Sprint 7', state: 'Active' },
]

function tasksOf(
  tasks: BoardTask[],
  scheduling: IdeaTasks['scheduling'] | undefined = undefined,
): IdeaTasks {
  return {
    tasks,
    referenced: { id: 'b-1', name: 'Implementation', lanes: LANES },
    referenceLane: { id: 'l-ref', name: 'Implementation lane' },
    inLane: true,
    nextLane: null,
    canMove: true,
    adding: { members: [], tags: [] },
    scheduling:
      scheduling === undefined
        ? {
            sprints: SPRINTS,
            canCreate: true,
            backlog: TASKS,
            backlogTotal: TASKS.length,
            members: [{ id: 'u-ada', name: 'Ada Lovelace' }],
          }
        : scheduling,
  }
}

const unscheduled = () => tasksOf([task('2', { sprint: null })])
const scheduleButton = (name: string) => screen.getByRole('button', { name: `Schedule ${name}` })
const dialog = () => screen.getByRole('alertdialog')
const optionTexts = (root: HTMLElement) =>
  within(root)
    .getAllByRole('option')
    .map((option) => option.textContent)

beforeEach(() => {
  move.mockReset().mockResolvedValue({ error: null })
  create.mockReset().mockResolvedValue({ ok: true })
  mocks.refresh.mockReset()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('TasksSection: sprint per task', () => {
  it('names the sprint a task is in, and says "No sprint" for one that is in none', () => {
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([task('1', { sprint: IN_SPRINT }), task('2', { sprint: null })])}
      />,
    )

    const [first, second] = screen.getAllByRole('listitem') as HTMLElement[]
    expect(within(first as HTMLElement).getByText('Sprint 7')).toBeTruthy()
    expect(within(first as HTMLElement).queryByText('No sprint')).toBeNull()
    expect(within(second as HTMLElement).getByText('No sprint')).toBeTruthy()
  })

  it('says nothing about a task whose sprint is unknown, and offers no Schedule for it', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('1')])} />)

    expect(screen.queryByText('No sprint')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Schedule/ })).toBeNull()
  })
})

describe('TasksSection: who is offered Schedule…', () => {
  it('offers it for an unscheduled task only', () => {
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([task('1', { sprint: IN_SPRINT }), task('2', { sprint: null })])}
      />,
    )

    expect(screen.getAllByRole('button', { name: /^Schedule/ })).toHaveLength(1)
    expect(scheduleButton('W-2').textContent).toBe('Schedule…')
  })

  it('hides it when the reader may not plan (scheduling is null), keeping the sprint label', () => {
    render(<TasksSection parent={PARENT} tasks={tasksOf([task('2', { sprint: null })], null)} />)

    expect(screen.queryByRole('button', { name: /^Schedule/ })).toBeNull()
    expect(screen.getByText('No sprint')).toBeTruthy()
  })
})

describe('TasksSection: Schedule… for a User', () => {
  const user = (sprints: typeof SPRINTS): IdeaTasks['scheduling'] => ({
    sprints,
    canCreate: false,
    backlog: [],
    backlogTotal: 0,
    members: [],
  })

  it('hides it on a task the reader may not edit', () => {
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([task('2', { sprint: null, mayEdit: false })], user(SPRINTS))}
      />,
    )

    expect(screen.queryByRole('button', { name: /^Schedule/ })).toBeNull()
  })

  it('disables it with the reason when the board has no open sprint, and offers no create option', () => {
    render(
      <TasksSection parent={PARENT} tasks={tasksOf([task('2', { sprint: null })], user([]))} />,
    )

    const button = scheduleButton('W-2')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('title')).toBe(
      'This board has no Planned or Active sprint to schedule into.',
    )
  })

  it('offers the open sprints but not "Create a new sprint…"', () => {
    render(
      <TasksSection
        parent={PARENT}
        tasks={tasksOf([task('2', { sprint: null })], user(SPRINTS))}
      />,
    )
    fireEvent.click(scheduleButton('W-2'))

    expect(screen.queryByRole('option', { name: 'Create a new sprint…' })).toBeNull()
  })
})

describe('TasksSection: the Schedule dialog', () => {
  it('lists the open sprints and the create option, and nothing else', () => {
    render(<TasksSection parent={PARENT} tasks={unscheduled()} />)

    fireEvent.click(scheduleButton('W-2'))

    expect(optionTexts(dialog())).toEqual([
      'Sprint 8 · Planned',
      'Sprint 7 · Active',
      'Create a new sprint…',
    ])
  })

  it('moves the task into the chosen sprint without a status, then refreshes and closes', async () => {
    render(<TasksSection parent={PARENT} tasks={unscheduled()} />)
    fireEvent.click(scheduleButton('W-2'))
    fireEvent.change(within(dialog()).getByLabelText('Sprint'), { target: { value: 's-act' } })

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Schedule' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(move).toHaveBeenCalledTimes(1)
    expect(move.mock.calls[0]).toEqual(['b-1', 's-act', ['2']])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('defaults to the first open sprint', async () => {
    render(<TasksSection parent={PARENT} tasks={unscheduled()} />)
    fireEvent.click(scheduleButton('W-2'))

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Schedule' }))

    await waitFor(() => expect(move).toHaveBeenCalledTimes(1))
    expect(move.mock.calls[0]?.[1]).toBe('s-plan')
  })

  it('shows the refusal, stays open and does not refresh when the server refuses', async () => {
    move.mockResolvedValue({ error: 'W-2 is blocked by W-9.' })
    render(<TasksSection parent={PARENT} tasks={unscheduled()} />)
    fireEvent.click(scheduleButton('W-2'))

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Schedule' }))

    expect((await within(dialog()).findByRole('alert')).textContent).toBe('W-2 is blocked by W-9.')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('closes on Cancel without calling the server', () => {
    render(<TasksSection parent={PARENT} tasks={unscheduled()} />)
    fireEvent.click(scheduleButton('W-2'))

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(move).not.toHaveBeenCalled()
  })

  it('offers only the create option when the board has no open sprint', () => {
    const tasks = tasksOf([task('2', { sprint: null })])
    if (tasks.scheduling) tasks.scheduling.sprints = []
    render(<TasksSection parent={PARENT} tasks={tasks} />)

    fireEvent.click(scheduleButton('W-2'))

    expect(optionTexts(dialog())).toEqual(['Create a new sprint…'])
    expect(within(dialog()).getByRole('button', { name: 'Create a sprint…' })).toBeTruthy()
  })
})

describe('TasksSection: Create a new sprint…', () => {
  // Task "2" of the Backlog fixture is "Seven alpha"; the drawer ticks the row's own task id.
  const choose = () => {
    render(<TasksSection parent={PARENT} tasks={unscheduled()} />)
    fireEvent.click(scheduleButton('W-2'))
    fireEvent.change(within(dialog()).getByLabelText('Sprint'), { target: { value: 'new' } })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Create a sprint…' }))
  }

  it('opens the create drawer with this task ticked and assigns nothing yet', () => {
    choose()

    expect(
      (screen.getByRole('checkbox', { name: /Seven alpha/ }) as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: /Standalone chore/ }) as HTMLInputElement).checked,
    ).toBe(false)
    expect(move).not.toHaveBeenCalled()
  })

  it('creates the sprint with that task and refreshes the page', async () => {
    choose()
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Sprint 9' } })
    fireEvent.change(screen.getByLabelText(/^Start/), { target: { value: '2026-11-02' } })
    fireEvent.change(screen.getByLabelText(/^End/), { target: { value: '2026-11-13' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create sprint with 1 task' }))
    })

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(create.mock.calls[0])).toContain('"2"')
  })
})
