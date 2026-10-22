import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SprintTaskPicker } from '@/components/boards/sprint-task-picker'
import type { Idea } from '@/lib/types'
import { TASKS, task } from './support/backlog-fixtures'

/**
 * The create-sprint drawer's task picker (TB-3, TB-4, comp W screen 3 frame A): it lists what it is
 * given (the API sends only the board's unassigned tasks), narrows by search and parent, shows a
 * blocker without refusing the pick, counts the selection and puts a refusal under the list.
 */
function picker(
  over: { tasks?: readonly Idea[]; selected?: string[]; error?: string | null } = {},
) {
  const onChange = vi.fn()
  const view = render(
    <SprintTaskPicker
      tasks={over.tasks ?? TASKS}
      selected={new Set(over.selected ?? [])}
      onChange={onChange}
      error={over.error ?? null}
    />,
  )
  return { onChange, view }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const ids = (fn: ReturnType<typeof vi.fn>): string[] => [
  ...((fn.mock.calls[0]?.[0] as Set<string> | undefined) ?? []),
]
const rows = () => screen.queryAllByRole('checkbox').map((box) => box.closest('label')?.textContent)
const parent = () => screen.getByLabelText('Parent idea') as HTMLSelectElement
const selectAll = () => screen.getByRole('button', { name: /^Select all/ }) as HTMLButtonElement
const status = () => screen.getByRole('status').textContent ?? ''

describe('SprintTaskPicker list', () => {
  it('lists every task it was given, with key, title and parent or standalone mark', () => {
    picker()
    expect(rows()).toHaveLength(4)
    const first = screen.getAllByRole('checkbox')[0]?.closest('label') as HTMLElement
    expect(within(first).getByText('W-1')).toBeTruthy()
    expect(within(first).getByText('Standalone chore')).toBeTruthy()
    expect(within(first).getByText('standalone')).toBeTruthy()
    const second = screen.getAllByRole('checkbox')[1]?.closest('label') as HTMLElement
    expect(within(second).getByText(/IDEA-7/)).toBeTruthy()
  })

  it('says the sprint starts empty when no task is waiting, and lists no checkbox', () => {
    picker({ tasks: [] })
    expect(screen.getByText(/The sprint starts empty/)).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('offers the parents of the tasks it holds, and nothing else', () => {
    picker()
    expect([...parent().options].map((option) => option.textContent)).toEqual([
      'All parent ideas',
      'Standalone (no parent)',
      'IDEA-7',
      'IDEA-8',
    ])
  })
})

describe('SprintTaskPicker filters', () => {
  it('searches title, key and parent key', () => {
    picker()
    const search = screen.getByLabelText('Search tasks')
    fireEvent.change(search, { target: { value: 'chore' } })
    expect(rows()).toHaveLength(1)
    fireEvent.change(search, { target: { value: 'w-4' } })
    expect(rows()?.[0]).toContain('Eight alpha')
    fireEvent.change(search, { target: { value: 'idea-7' } })
    expect(rows()).toHaveLength(2)
  })

  it('says nothing matches when the search finds nothing', () => {
    picker()
    fireEvent.change(screen.getByLabelText('Search tasks'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText('No task matches.')).toBeTruthy()
  })

  it('filters to one parent idea', () => {
    picker()
    fireEvent.change(parent(), { target: { value: 'p-7' } })
    expect(rows()).toHaveLength(2)
    expect(rows()?.join()).not.toContain('Eight alpha')
  })

  it('filters to standalone tasks', () => {
    picker()
    fireEvent.change(parent(), { target: { value: 'none' } })
    expect(rows()).toHaveLength(1)
    expect(rows()?.[0]).toContain('Standalone chore')
  })
})

describe('SprintTaskPicker select all of a parent', () => {
  it('is disabled until a parent idea is chosen, with the reason', () => {
    picker()
    expect(selectAll().disabled).toBe(true)
    expect(selectAll().title).toBe('Choose a parent idea in the filter first.')
  })

  it('stays disabled for the standalone filter', () => {
    picker()
    fireEvent.change(parent(), { target: { value: 'none' } })
    expect(selectAll().disabled).toBe(true)
  })

  it('names the chosen parent and ticks all its tasks on top of what is ticked', () => {
    const { onChange } = picker({ selected: ['4'] })
    fireEvent.change(parent(), { target: { value: 'p-7' } })
    expect(selectAll().disabled).toBe(false)
    expect(selectAll().textContent).toBe('Select all IDEA-7 tasks')
    fireEvent.click(selectAll())
    expect(ids(onChange).sort()).toEqual(['2', '3', '4'])
  })

  it('ticks the parent’s tasks even those the search hides', () => {
    const { onChange } = picker()
    fireEvent.change(parent(), { target: { value: 'p-7' } })
    fireEvent.change(screen.getByLabelText('Search tasks'), {
      target: { value: 'alpha' },
    })
    fireEvent.click(selectAll())
    expect(ids(onChange).sort()).toEqual(['2', '3'])
  })
})

describe('SprintTaskPicker selection', () => {
  it('toggles a task on and off through onChange', () => {
    const { onChange, view } = picker()
    fireEvent.click(screen.getByRole('checkbox', { name: /Seven alpha/ }))
    expect(ids(onChange)).toEqual(['2'])
    view.unmount()
    const again = picker({ selected: ['2'] })
    fireEvent.click(screen.getByRole('checkbox', { name: /Seven alpha/ }))
    expect(ids(again.onChange)).toEqual([])
  })

  it('shows a ticked task as checked', () => {
    picker({ selected: ['4'] })
    expect(
      (screen.getByRole('checkbox', { name: /Eight alpha/ }) as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: /Seven alpha/ }) as HTMLInputElement).checked,
    ).toBe(false)
  })

  it('shows the blocker on a blocked task and still lets it be picked', () => {
    const { onChange } = picker()
    const row = screen.getByRole('checkbox', { name: /Seven beta/ }).closest('label') as HTMLElement
    expect(within(row).getByText('blocked by W-9')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Seven beta/ }))
    expect(ids(onChange)).toEqual(['3'])
  })

  it('shows no blocker chip when the blocker is already done', () => {
    picker({
      tasks: [task('5', { blockedBy: [{ ideaId: 'x', itemKey: 'W-9', isFinal: true }] })],
    })
    expect(screen.queryByText(/blocked by/)).toBeNull()
  })
})

describe('SprintTaskPicker counts', () => {
  it('says how many are unassigned, and shows no "from ideas" with nothing ticked', () => {
    picker()
    expect(status()).toContain('0 selected')
    expect(status()).toContain('4 unassigned')
    expect(status()).not.toMatch(/from \d+ idea/)
  })

  it('counts the ticked tasks and the distinct ideas they come from', () => {
    picker({ selected: ['2', '3', '4'] })
    expect(status()).toContain('3 selected')
    expect(status()).toContain('from 2 ideas')
  })

  it('says "1 idea" in the singular when the ticked tasks share a parent', () => {
    picker({ selected: ['2', '3'] })
    expect(status()).toContain('from 1 idea')
    expect(status()).not.toContain('1 ideas')
  })

  it('counts a standalone task as an idea of its own', () => {
    picker({ selected: ['1', '2'] })
    expect(status()).toContain('from 2 ideas')
  })

  it('says "N of M unassigned" while a filter narrows the list', () => {
    picker()
    fireEvent.change(parent(), { target: { value: 'p-7' } })
    expect(status()).toContain('2 of 4 unassigned')
  })
})

describe('SprintTaskPicker refusal', () => {
  it('shows the keyed message under the list as an alert', () => {
    picker({ error: 'W-3: that task is already in a sprint.' })
    expect(screen.getByRole('alert').textContent).toBe('W-3: that task is already in a sprint.')
  })

  it('shows no alert without an error', () => {
    picker()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
