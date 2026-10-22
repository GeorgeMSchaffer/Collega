import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SprintCreateDrawer } from '@/components/boards/sprint-create-drawer'
import { createBoardSprint } from '@/lib/server/sprint-planning-actions'
import { TASKS } from './support/backlog-fixtures'

/**
 * The create-sprint drawer on a work board (TB-3, TB-4, comp W screen 3 frame A): the sprint's
 * fields with the task picker, the footer's count, the request that carries `ideaIds`, a refused
 * task shown under the picker with the drawer left open, and a success that hands control back.
 * The server action is the boundary.
 */
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  createBoardSprint: vi.fn(),
  addTasksToSprint: vi.fn(),
}))
const create = vi.mocked(createBoardSprint)

const onClose = vi.fn()
const onCreated = vi.fn()

function drawer(initialIds: readonly string[] = [], open = true) {
  return (
    <SprintCreateDrawer
      open={open}
      onClose={onClose}
      boardId="b-1"
      boardName="Implementation"
      tasks={TASKS}
      initialIds={initialIds}
      members={[{ id: 'u-ada', name: 'Ada Lovelace' }]}
      onCreated={onCreated}
    />
  )
}

const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement
const footer = () =>
  screen.getAllByRole('button').find((b) => /^Create sprint|^Creating/.test(b.textContent ?? ''))
const fill = () => {
  fireEvent.change(field(/^Name/), { target: { value: '  Sprint 9 ' } })
  fireEvent.change(field(/^Start/), { target: { value: '2026-11-02' } })
  fireEvent.change(field(/^End/), { target: { value: '2026-11-13' } })
}
const submit = async () => {
  await act(async () => {
    fireEvent.click(footer() as HTMLElement)
  })
}
const tick = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }))

beforeEach(() => {
  create.mockReset().mockResolvedValue({ ok: true })
  onClose.mockReset()
  onCreated.mockReset()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('SprintCreateDrawer footer', () => {
  it('says "Create sprint" with nothing ticked', () => {
    render(drawer())
    expect(footer()?.textContent).toBe('Create sprint')
  })

  it('counts the ticked tasks, singular and plural', () => {
    render(drawer())
    tick(/Seven alpha/)
    expect(footer()?.textContent).toBe('Create sprint with 1 task')
    tick(/Eight alpha/)
    expect(footer()?.textContent).toBe('Create sprint with 2 tasks')
    tick(/Eight alpha/)
    expect(footer()?.textContent).toBe('Create sprint with 1 task')
  })

  it('starts from the tasks the Backlog had ticked', () => {
    render(drawer(['1', '4']))
    expect(footer()?.textContent).toBe('Create sprint with 2 tasks')
    expect(
      (screen.getByRole('checkbox', { name: /Standalone chore/ }) as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: /Seven alpha/ }) as HTMLInputElement).checked,
    ).toBe(false)
  })

  it('starts again from the Backlog’s selection each time it opens', () => {
    const { rerender } = render(drawer(['1']))
    tick(/Seven alpha/)
    rerender(drawer(['1'], false))
    rerender(drawer(['4'], true))
    expect(footer()?.textContent).toBe('Create sprint with 1 task')
    expect(
      (screen.getByRole('checkbox', { name: /Eight alpha/ }) as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: /Seven alpha/ }) as HTMLInputElement).checked,
    ).toBe(false)
  })
})

describe('SprintCreateDrawer request', () => {
  it('sends the ticked ids with the trimmed sprint fields', async () => {
    render(drawer(['2']))
    tick(/Eight alpha/)
    fill()
    await submit()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      'b-1',
      {
        name: 'Sprint 9',
        goal: '',
        startDate: '2026-11-02',
        endDate: '2026-11-13',
        ownerUserId: '',
      },
      expect.any(Array),
    )
    expect([...(create.mock.calls[0]?.[2] ?? [])].sort()).toEqual(['2', '4'])
  })

  it('sends no ids for a sprint created empty', async () => {
    render(drawer())
    fill()
    await submit()
    expect(create.mock.calls[0]?.[2]).toEqual([])
  })

  it('sends nothing when the sprint’s own checks fail', async () => {
    render(drawer(['2']))
    await submit()
    expect(screen.getByText('Name is required.')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })
})

describe('SprintCreateDrawer outcome', () => {
  it('hands back the number of tasks created with, and does not close itself on a refusal', async () => {
    render(drawer(['2', '3']))
    fill()
    await submit()
    await waitFor(() => expect(onCreated).toHaveBeenCalledExactlyOnceWith(2))
  })

  it('shows a refused task’s keyed message under the picker and leaves everything in place', async () => {
    create.mockResolvedValue({
      ok: false,
      error: null,
      errors: { ideaIds: 'W-3: that task is already in a sprint.' },
    })
    render(drawer(['2', '3']))
    fill()
    await submit()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'W-3: that task is already in a sprint.',
    )
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(footer()?.textContent).toBe('Create sprint with 2 tasks')
    expect(field(/^Name/).value).toBe('  Sprint 9 ')
  })

  it('clears the refusal once the ticks change', async () => {
    create.mockResolvedValue({ ok: false, error: null, errors: { ideaIds: 'W-3: gone.' } })
    render(drawer(['3']))
    fill()
    await submit()
    await screen.findByRole('alert')
    tick(/Seven beta/)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('puts the sprint’s own refusals beside their fields, not under the picker', async () => {
    create.mockResolvedValue({
      ok: false,
      error: null,
      errors: { name: 'A sprint with this name exists.' },
    })
    render(drawer(['2']))
    fill()
    await submit()
    expect(await screen.findByText('A sprint with this name exists.')).toBeTruthy()
    expect(field(/^Name/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByRole('alert')?.textContent ?? '').not.toContain('exists')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('renders nothing of the form while closed', () => {
    render(drawer(['2'], false))
    expect(screen.queryByLabelText(/^Name/)).toBeNull()
  })
})
