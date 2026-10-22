import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BacklogList } from '@/components/boards/backlog-list'
import { createBoardSprint, moveTasksToSprint } from '@/lib/server/sprint-planning-actions'
import type { Idea, Sprint } from '@/lib/types'
import { TASKS } from './support/backlog-fixtures'

/**
 * The Backlog's selection bar (TB-5, TB-10, comp W screen 3): who gets it, which sprints it offers,
 * what each button sends, "Add to new sprint…" opening the drawer with the ticked rows, and what is
 * left behind after a success. The server actions are the boundary.
 */
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  moveTasksToSprint: vi.fn(),
  createBoardSprint: vi.fn(),
}))
const add = vi.mocked(moveTasksToSprint)
const create = vi.mocked(createBoardSprint)

const sprint = (id: string, name: string, state: Sprint['state']): Sprint => ({
  id,
  name,
  goal: null,
  startsOn: '',
  endsOn: '',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  window: '',
  state,
  issueCount: 0,
  doneCount: 0,
})
const ACTIVE = sprint('s-a', 'Sprint 8', 'Active')
const PLANNED = sprint('s-p', 'Sprint 9', 'Planned')
const DONE = sprint('s-c', 'Sprint 7', 'Completed')
const LANES = [{ id: 'l-1', name: 'To do', color: '#111111', isFinal: false }]

const props = (over: Partial<Parameters<typeof BacklogList>[0]> = {}) => (
  <BacklogList
    boardId="b-1"
    boardName="Implementation"
    rows={TASKS}
    total={TASKS.length}
    lanes={LANES}
    canSelect
    newTaskHref={null}
    sprints={[ACTIVE]}
    members={[{ id: 'u-ada', name: 'Ada Lovelace' }]}
    {...over}
  />
)
const list = (over: Partial<Parameters<typeof BacklogList>[0]> = {}) => render(props(over))
const pick = (key: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: `Select ${key}` }))
const bar = () => screen.queryByRole('region', { name: 'Selected tasks' })
const barButton = (name: string | RegExp) =>
  within(bar() as HTMLElement).getByRole('button', { name })
const sprintSelect = () => screen.queryByLabelText('Sprint to add to') as HTMLSelectElement | null
const click = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el)
  })
}

beforeEach(() => {
  add.mockReset().mockResolvedValue({ error: null })
  create.mockReset().mockResolvedValue({ ok: true })
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Backlog selection bar visibility', () => {
  it('appears once a task is ticked, counts them, and goes when selection clears', () => {
    list()
    expect(bar()).toBeNull()
    pick('W-1')
    pick('W-2')
    expect(within(bar() as HTMLElement).getByText('2 selected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(bar()).toBeNull()
  })

  it('does not exist for a reader who cannot plan, and offers no way to start a sprint', () => {
    list({ canSelect: false })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(bar()).toBeNull()
    expect(screen.queryByRole('button', { name: /New sprint/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add to/ })).toBeNull()
    expect(screen.queryByLabelText(/^Name/)).toBeNull()
  })
})

describe('Backlog selection bar sprint choice', () => {
  it('offers the one open sprint by name and state, with no sprint select', () => {
    list({ sprints: [ACTIVE] })
    pick('W-1')
    expect(sprintSelect()).toBeNull()
    expect(barButton('Add to Sprint 8 (Active)')).toBeTruthy()
  })

  it('offers only "Add to new sprint…" when no sprint is open', () => {
    list({ sprints: [DONE] })
    pick('W-1')
    expect(sprintSelect()).toBeNull()
    expect(
      within(bar() as HTMLElement).queryByRole('button', { name: /^Add to Sprint/ }),
    ).toBeNull()
    expect(barButton('Add to new sprint…')).toBeTruthy()
  })

  it('offers only "Add to new sprint…" on a board with no sprints at all', () => {
    list({ sprints: [] })
    pick('W-1')
    expect(barButton('Add to new sprint…')).toBeTruthy()
    expect(within(bar() as HTMLElement).getAllByRole('button')).toHaveLength(1)
  })

  it('never offers a Completed sprint, and lists the Active one first', () => {
    list({ sprints: [DONE, PLANNED, ACTIVE] })
    pick('W-1')
    expect([...(sprintSelect()?.options ?? [])].map((o) => o.textContent)).toEqual([
      'Sprint 8 (Active)',
      'Sprint 9 (Planned)',
    ])
    expect(barButton('Add to Sprint 8 (Active)')).toBeTruthy()
  })

  it('names the sprint picked in the select on the button and adds to that one', async () => {
    list({ sprints: [ACTIVE, PLANNED] })
    pick('W-1')
    fireEvent.change(sprintSelect() as HTMLSelectElement, { target: { value: 's-p' } })
    await click(barButton('Add to Sprint 9 (Planned)'))
    expect(add).toHaveBeenCalledExactlyOnceWith('b-1', 's-p', ['1'])
  })
})

describe('Backlog selection bar adding to a sprint', () => {
  it('sends the ticked ids and the sprint, then clears the selection and says so', async () => {
    list()
    pick('W-1')
    pick('W-3')
    await click(barButton('Add to Sprint 8 (Active)'))
    expect(add).toHaveBeenCalledExactlyOnceWith('b-1', 's-a', ['1', '3'])
    await waitFor(() => expect(bar()).toBeNull())
    expect(screen.getByText(/Added 2 tasks to Sprint 8\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()
  })

  it('puts the confirmation in its own status line, apart from the count, and moves focus to it', async () => {
    list()
    pick('W-1')
    await click(barButton(/^Add to Sprint 8/))
    const note = await screen.findByText(/Added 1 task to Sprint 8\./)
    expect(note.getAttribute('role')).toBe('status')
    expect(note.tabIndex).toBe(-1)
    await waitFor(() => expect(document.activeElement).toBe(note))
    const count = screen.getAllByRole('status').find((el) => el !== note) as HTMLElement
    expect(count.textContent).not.toContain('Added')
  })

  it('keeps the confirmation, announced, when the Backlog empties after the add', async () => {
    const view = list({ rows: [TASKS[0] as Idea], total: 1 })
    pick('W-1')
    await click(barButton(/^Add to Sprint 8/))
    await screen.findByText(/Added 1 task to Sprint 8\./)
    view.rerender(props({ rows: [], total: 0 }))
    const note = screen.getByText(/Added 1 task to Sprint 8\./)
    expect(note.getAttribute('role')).toBe('status')
    expect(screen.getByText('Nothing waiting for a sprint')).toBeTruthy()
  })

  it('says "1 task" for a single task', async () => {
    list()
    pick('W-2')
    await click(barButton(/^Add to Sprint 8/))
    expect(await screen.findByText(/Added 1 task to Sprint 8\./)).toBeTruthy()
  })

  it('keeps the selection and shows the refusal in the bar', async () => {
    add.mockResolvedValue({ error: 'W-3: that task is on another board.' })
    list()
    pick('W-3')
    await click(barButton(/^Add to Sprint 8/))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'W-3: that task is on another board.',
    )
    expect(bar()).not.toBeNull()
    expect((screen.getByRole('checkbox', { name: 'Select W-3' }) as HTMLInputElement).checked).toBe(
      true,
    )
    expect(screen.queryByText(/^.*Added \d/)).toBeNull()
  })
})

describe('Backlog "Add to new sprint…"', () => {
  it('opens the create drawer with exactly the ticked tasks ticked', async () => {
    list()
    pick('W-2')
    pick('W-4')
    await click(barButton('Add to new sprint…'))
    expect(screen.getByRole('button', { name: 'Create sprint with 2 tasks' })).toBeTruthy()
    const dialog = screen.getByRole('complementary', { name: 'Create a sprint' })
    expect(
      within(dialog)
        .getAllByRole('checkbox')
        .filter((box) => (box as HTMLInputElement).checked),
    ).toHaveLength(2)
  })

  it('opens the drawer empty from the toolbar’s "+ New sprint…" with nothing ticked', async () => {
    list()
    await click(screen.getByRole('button', { name: '+ New sprint…' }))
    expect(screen.getByRole('button', { name: 'Create sprint' })).toBeTruthy()
  })

  it('creates the sprint with the ticked ids, then closes, clears selection and says so', async () => {
    list()
    pick('W-2')
    pick('W-4')
    await click(barButton('Add to new sprint…'))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Sprint 10' } })
    fireEvent.change(screen.getByLabelText(/^Start/), { target: { value: '2026-11-16' } })
    fireEvent.change(screen.getByLabelText(/^End/), { target: { value: '2026-11-27' } })
    await click(screen.getByRole('button', { name: 'Create sprint with 2 tasks' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create.mock.calls[0]?.[0]).toBe('b-1')
    expect([...(create.mock.calls[0]?.[2] ?? [])].sort()).toEqual(['2', '4'])
    await waitFor(() => expect(screen.queryByLabelText(/^Name/)).toBeNull())
    expect(bar()).toBeNull()
    expect(screen.getByText(/Sprint created with 2 tasks\./)).toBeTruthy()
  })

  it('keeps the drawer, the ticks and the selection when a task is refused', async () => {
    create.mockResolvedValue({
      ok: false,
      error: null,
      errors: { ideaIds: 'W-4: that task is already in a sprint.' },
    })
    list()
    pick('W-4')
    await click(barButton('Add to new sprint…'))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Sprint 10' } })
    fireEvent.change(screen.getByLabelText(/^Start/), { target: { value: '2026-11-16' } })
    fireEvent.change(screen.getByLabelText(/^End/), { target: { value: '2026-11-27' } })
    await click(screen.getByRole('button', { name: 'Create sprint with 1 task' }))
    expect(await screen.findByText('W-4: that task is already in a sprint.')).toBeTruthy()
    expect(screen.getByLabelText(/^Name/)).toBeTruthy()
    expect(bar()).not.toBeNull()
    expect(screen.queryByText(/Sprint created/)).toBeNull()
  })

  it('offers the picker the Backlog rows as sent, whatever filter is active', async () => {
    list()
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'chore' } })
    await click(screen.getByRole('button', { name: '+ New sprint…' }))
    const dialog = screen.getByRole('complementary', { name: 'Create a sprint' })
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(TASKS.length)
  })
})
