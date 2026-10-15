import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type QuickAddField,
  type QuickAddLayout,
  type QuickAddResult,
  QuickAddRow,
  type QuickAddValues,
} from '@/components/list'

/**
 * The quick-add row (`20-feature-client-ui.md` "Quick-add row"): both hand-off modes, the refusal
 * path with its messages and focus, the saving state, server field errors in create mode, and what
 * a success clears and keeps. Hand-offs and submits are the boundary and are replaced; the 3.2 s
 * toast and the focus-after-frame callbacks run on fake timers.
 */
const LAYOUT: QuickAddLayout = {
  columns: [{ key: 'title' }, { key: 'effort' }, { key: 'status' }],
  hasActions: true,
}

const FIELDS: QuickAddField[] = [
  {
    name: 'title',
    label: 'Title',
    column: 'title',
    required: true,
    placeholder: 'Add an issue',
    maxLength: 40,
  },
  {
    name: 'effort',
    label: 'Effort',
    column: 'effort',
    required: true,
    options: [
      { value: 'Low', label: 'Low' },
      { value: 'High', label: 'High' },
    ],
    placeholder: 'Choose effort',
  },
  {
    name: 'sprint',
    label: 'Sprint',
    column: 'status',
    options: [
      { value: '', label: 'Backlog' },
      { value: 's1', label: 'Sprint 1' },
    ],
    defaultValue: '',
  },
]

type Props = Partial<React.ComponentProps<typeof QuickAddRow>>

function Table({ layout = LAYOUT, ...props }: Props) {
  const mode = props.handoff === 'create' ? {} : { handoff: 'drawer', onHandoff: () => {} }
  const all = {
    layout,
    fields: FIELDS,
    canAdd: true,
    label: 'Quick add issue',
    rowIds: '',
    testId: 'qa',
    ...mode,
    ...props,
  } as React.ComponentProps<typeof QuickAddRow>
  return (
    <table>
      <tbody>
        <QuickAddRow {...all} />
      </tbody>
    </table>
  )
}

const title = () => screen.getByLabelText('Title') as HTMLInputElement
const effort = () => screen.getByLabelText('Effort') as HTMLSelectElement
const sprint = () => screen.getByLabelText('Sprint') as HTMLSelectElement
const row = () => screen.getByRole('row', { name: 'Quick add issue' })
const addButton = () => screen.getByTestId('qa-add')

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key: k, ...init })
const frame = () => act(() => vi.advanceTimersByTime(20))
const polite = () => row().querySelector('[aria-live="polite"]') as HTMLElement

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('QuickAddRow visibility', () => {
  it('renders nothing when the role may not add', () => {
    render(<Table canAdd={false} />)
    expect(screen.queryByRole('row')).toBeNull()
    expect(screen.queryByLabelText('Title')).toBeNull()
  })

  it('renders the row with its accessible name and one control per field', () => {
    render(<Table />)
    expect(row()).toBeTruthy()
    expect(title().tagName).toBe('INPUT')
    expect(effort().tagName).toBe('SELECT')
    expect(sprint().tagName).toBe('SELECT')
    expect(title().maxLength).toBe(40)
  })

  it('puts each field under its own column and the Add button in the Actions cell', () => {
    render(<Table />)
    const cells = within(row()).getAllByRole('cell')
    expect(cells).toHaveLength(4)
    expect(within(cells[0] as HTMLElement).getByLabelText('Title')).toBeTruthy()
    expect(within(cells[1] as HTMLElement).getByLabelText('Effort')).toBeTruthy()
    expect(within(cells[2] as HTMLElement).getByLabelText('Sprint')).toBeTruthy()
    expect(within(cells[3] as HTMLElement).getByTestId('qa-add')).toBeTruthy()
  })

  it('puts the Add button under the last column when the table has no Actions column', () => {
    render(<Table layout={{ columns: LAYOUT.columns, hasActions: false }} />)
    const cells = within(row()).getAllByRole('cell')
    expect(cells).toHaveLength(3)
    expect(within(cells[2] as HTMLElement).getByTestId('qa-add')).toBeTruthy()
  })

  it('puts a field with no column under the Title column', () => {
    const fields: QuickAddField[] = [
      { name: 'title', label: 'Title', required: true },
      { name: 'note', label: 'Note' },
    ]
    render(<Table fields={fields} />)
    const first = within(row()).getAllByRole('cell')[0] as HTMLElement
    expect(within(first).getByLabelText('Note')).toBeTruthy()
  })
})

describe('QuickAddRow drawer hand-off', () => {
  it('hands over trimmed values on Enter and clears the row', () => {
    const onHandoff = vi.fn<(values: QuickAddValues) => void>()
    render(<Table onHandoff={onHandoff} />)
    type(title(), '  Fix the door  ')
    type(effort(), 'High')
    type(sprint(), 's1')
    key(title(), 'Enter')
    expect(onHandoff).toHaveBeenCalledExactlyOnceWith({
      title: 'Fix the door',
      effort: 'High',
      sprint: 's1',
    })
    expect(title().value).toBe('')
    expect(effort().value).toBe('')
    // The drawer owns the values now, so even an optional select returns to its default.
    expect(sprint().value).toBe('')
  })

  it('submits from Enter in any control, including a select', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), 'A')
    type(effort(), 'Low')
    key(effort(), 'Enter')
    expect(onHandoff).toHaveBeenCalledTimes(1)
  })

  it('treats the Add button as Enter', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), 'A')
    type(effort(), 'Low')
    fireEvent.click(addButton())
    expect(onHandoff).toHaveBeenCalledTimes(1)
  })

  it('does not hand off while an input method is composing', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), 'A')
    type(effort(), 'Low')
    key(title(), 'Enter', { isComposing: true })
    expect(onHandoff).not.toHaveBeenCalled()
  })

  it('does not treat Enter on a button as a submit', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), 'A')
    type(effort(), 'Low')
    key(addButton(), 'Enter')
    expect(onHandoff).not.toHaveBeenCalled()
  })

  it('offers More fields, which hands over without validating and clears', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), ' half done ')
    fireEvent.click(screen.getByRole('button', { name: 'More fields' }))
    expect(onHandoff).toHaveBeenCalledExactlyOnceWith({
      title: 'half done',
      effort: '',
      sprint: '',
    })
    expect(title().value).toBe('')
  })

  it('says Enter opens the form rather than adds', () => {
    render(<Table />)
    expect(row().textContent).toContain('opens the form')
  })
})

describe('QuickAddRow refusal', () => {
  it('refuses an empty required Title with a message, aria-invalid and focus', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    key(title(), 'Enter')
    frame()
    expect(onHandoff).not.toHaveBeenCalled()
    expect(screen.getByText('Enter title.')).toBeTruthy()
    expect(title().getAttribute('aria-invalid')).toBe('true')
    expect(title().getAttribute('aria-describedby')).toBe(
      screen.getByText('Enter title.').getAttribute('id'),
    )
    expect(document.activeElement).toBe(title())
  })

  it('refuses a whitespace-only Title', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), '   ')
    type(effort(), 'Low')
    key(title(), 'Enter')
    expect(onHandoff).not.toHaveBeenCalled()
    expect(screen.getByText('Enter title.')).toBeTruthy()
  })

  it('words a missing required select as Choose, and focuses it when Title is fine', () => {
    const onHandoff = vi.fn()
    render(<Table onHandoff={onHandoff} />)
    type(title(), 'Something')
    fireEvent.click(addButton())
    frame()
    expect(onHandoff).not.toHaveBeenCalled()
    expect(screen.getByText('Choose effort.')).toBeTruthy()
    expect(effort().getAttribute('aria-invalid')).toBe('true')
    expect(title().getAttribute('aria-invalid')).toBeNull()
    expect(document.activeElement).toBe(effort())
  })

  it('marks every missing field and focuses the first in field order', () => {
    render(<Table />)
    key(title(), 'Enter')
    frame()
    expect(screen.getByText('Enter title.')).toBeTruthy()
    expect(screen.getByText('Choose effort.')).toBeTruthy()
    expect(document.activeElement).toBe(title())
    expect(polite().textContent).toBe('Not added. 2 fields need attention.')
  })

  it('announces a single missing field in the singular', () => {
    render(<Table />)
    type(effort(), 'Low')
    key(title(), 'Enter')
    expect(polite().textContent).toBe('Not added. 1 field needs attention.')
  })

  it('uses a field-specific required message when given', () => {
    const fields = FIELDS.map((f) =>
      f.name === 'title' ? { ...f, requiredMessage: 'Give it a name.' } : f,
    )
    render(<Table fields={fields} />)
    key(title(), 'Enter')
    expect(screen.getByText('Give it a name.')).toBeTruthy()
  })

  it('clears a field’s message when that field is edited', () => {
    render(<Table />)
    key(title(), 'Enter')
    type(title(), 'x')
    expect(screen.queryByText('Enter title.')).toBeNull()
    expect(title().getAttribute('aria-invalid')).toBeNull()
  })

  it('reports an error state on the row until the problem is fixed', () => {
    render(<Table />)
    expect(row().getAttribute('data-state')).toBe('idle')
    type(title(), 'x')
    expect(row().getAttribute('data-state')).toBe('typing')
    type(title(), '')
    key(title(), 'Enter')
    expect(row().getAttribute('data-state')).toBe('error')
  })

  it('keeps Add outline until the required fields are set, then primary', () => {
    render(<Table />)
    const before = addButton().className
    type(title(), 'x')
    type(effort(), 'Low')
    expect(addButton().className).not.toBe(before)
    // And it is never disabled: a dead button cannot say what is missing.
    expect((addButton() as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('QuickAddRow Escape', () => {
  it('clears typed values and errors and returns focus to Title', () => {
    render(<Table />)
    type(title(), 'draft')
    key(effort(), 'Enter')
    expect(screen.getByText('Choose effort.')).toBeTruthy()
    type(sprint(), 's1')
    key(effort(), 'Escape')
    expect(title().value).toBe('')
    expect(sprint().value).toBe('')
    expect(screen.queryByText('Choose effort.')).toBeNull()
    expect(document.activeElement).toBe(title())
  })

  it('clears an error shown on an otherwise untouched row', () => {
    render(<Table />)
    key(title(), 'Enter')
    expect(screen.getByText('Enter title.')).toBeTruthy()
    key(title(), 'Escape')
    expect(screen.queryByText('Enter title.')).toBeNull()
  })

  it('blurs the control when there is nothing to clear', () => {
    render(<Table />)
    title().focus()
    expect(document.activeElement).toBe(title())
    key(title(), 'Escape')
    expect(document.activeElement).not.toBe(title())
  })
})

describe('QuickAddRow create mode', () => {
  const ok = (extra: Partial<Extract<QuickAddResult, { ok: true }>> = {}): QuickAddResult => ({
    ok: true,
    ...extra,
  })

  it('submits trimmed values on Enter and does not offer More fields without a hand-off', () => {
    const onSubmit = vi.fn<(v: QuickAddValues) => Promise<QuickAddResult>>(async () => ok())
    render(<Table handoff="create" onSubmit={onSubmit} />)
    expect(screen.queryByRole('button', { name: 'More fields' })).toBeNull()
    type(title(), ' New ')
    type(effort(), 'Low')
    key(title(), 'Enter')
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ title: 'New', effort: 'Low', sprint: '' })
    expect(row().textContent).toContain('adds')
  })

  it('does not call onSubmit when a required field is empty', () => {
    const onSubmit = vi.fn(async () => ok())
    render(<Table handoff="create" onSubmit={onSubmit} />)
    key(title(), 'Enter')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the saving state and ignores a second Enter until the add settles', async () => {
    const pending = deferred<QuickAddResult>()
    const onSubmit = vi.fn(() => pending.promise)
    render(<Table handoff="create" onSubmit={onSubmit} />)
    type(title(), 'New')
    type(effort(), 'Low')
    await act(async () => key(title(), 'Enter'))

    expect(row().getAttribute('aria-busy')).toBe('true')
    expect(row().getAttribute('data-state')).toBe('saving')
    expect(addButton().getAttribute('aria-busy')).toBe('true')
    expect(addButton().textContent).toBe('Adding…')
    expect(title().disabled).toBe(true)
    expect(effort().disabled).toBe(true)

    // keydown is ignored while saving, and so is a click on Add.
    key(title(), 'Enter')
    fireEvent.click(addButton())
    expect(onSubmit).toHaveBeenCalledTimes(1)

    await act(async () => pending.resolve(ok()))
    expect(row().getAttribute('aria-busy')).toBeNull()
    expect(addButton().textContent).toBe('Add')
    expect(title().disabled).toBe(false)
  })

  it('on success clears Title and required selects but keeps an optional select', async () => {
    const onSubmit = vi.fn(async () => ok())
    render(<Table handoff="create" onSubmit={onSubmit} />)
    type(title(), 'New')
    type(effort(), 'High')
    type(sprint(), 's1')
    await act(async () => key(title(), 'Enter'))
    expect(title().value).toBe('')
    expect(effort().value).toBe('')
    expect(sprint().value).toBe('s1')
  })

  it('on success returns focus to Title once the controls are enabled again', async () => {
    render(<Table handoff="create" onSubmit={async () => ok()} />)
    type(title(), 'New')
    type(effort(), 'High')
    await act(async () => key(effort(), 'Enter'))
    frame()
    expect(document.activeElement).toBe(title())
  })

  it('toasts the result message, then the toast goes away', async () => {
    render(
      <Table handoff="create" onSubmit={async () => ok({ message: 'Issue added to Sprint 1' })} />,
    )
    type(title(), 'New')
    type(effort(), 'High')
    await act(async () => key(title(), 'Enter'))
    expect(screen.getByRole('status').textContent).toBe('Issue added to Sprint 1')
    act(() => vi.advanceTimersByTime(3300))
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('falls back to "Added" when the result has no message', async () => {
    render(<Table handoff="create" onSubmit={async () => ok()} />)
    type(title(), 'New')
    type(effort(), 'High')
    await act(async () => key(title(), 'Enter'))
    expect(screen.getByRole('status').textContent).toBe('Added')
  })

  it('marks the field a server refusal names, keeps what was typed and focuses it', async () => {
    const onSubmit = vi.fn(
      async (): Promise<QuickAddResult> => ({
        ok: false,
        error: null,
        errors: { title: 'That title is taken.' },
      }),
    )
    render(<Table handoff="create" onSubmit={onSubmit} />)
    type(title(), 'Dup')
    type(effort(), 'High')
    await act(async () => key(title(), 'Enter'))
    frame()
    expect(screen.getByText('That title is taken.')).toBeTruthy()
    expect(title().getAttribute('aria-invalid')).toBe('true')
    expect(title().value).toBe('Dup')
    expect(effort().value).toBe('High')
    expect(document.activeElement).toBe(title())
    expect(polite().textContent).toBe('Not added. 1 field needs attention.')
    expect(row().getAttribute('data-state')).toBe('error')
    // No success toast.
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows a refusal with no field as an alert and announces it', async () => {
    const onSubmit = vi.fn(
      async (): Promise<QuickAddResult> => ({ ok: false, error: 'Server said no.', errors: {} }),
    )
    render(<Table handoff="create" onSubmit={onSubmit} />)
    type(title(), 'Dup')
    type(effort(), 'High')
    await act(async () => key(title(), 'Enter'))
    expect(screen.getByRole('alert').textContent).toBe('Server said no.')
    expect(polite().textContent).toBe('Not added. Server said no.')
    expect(title().value).toBe('Dup')
    type(title(), 'Dup2')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('can add again after a refusal is corrected', async () => {
    const onSubmit = vi
      .fn<(v: QuickAddValues) => Promise<QuickAddResult>>()
      .mockResolvedValueOnce({ ok: false, error: null, errors: { title: 'Taken.' } })
      .mockResolvedValueOnce({ ok: true })
    render(<Table handoff="create" onSubmit={onSubmit} />)
    type(title(), 'Dup')
    type(effort(), 'High')
    await act(async () => key(title(), 'Enter'))
    type(title(), 'Unique')
    await act(async () => key(title(), 'Enter'))
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls[1]?.[0]?.title).toBe('Unique')
    expect(title().value).toBe('')
  })

  it('More fields hands off in create mode too, and is ignored while saving', async () => {
    const pending = deferred<QuickAddResult>()
    const onHandoff = vi.fn()
    render(<Table handoff="create" onSubmit={() => pending.promise} onHandoff={onHandoff} />)
    type(title(), 'New')
    type(effort(), 'High')
    await act(async () => key(title(), 'Enter'))
    fireEvent.click(screen.getByRole('button', { name: 'More fields' }))
    expect(onHandoff).not.toHaveBeenCalled()
    await act(async () => pending.resolve({ ok: true }))
    type(title(), 'More')
    fireEvent.click(screen.getByRole('button', { name: 'More fields' }))
    expect(onHandoff).toHaveBeenCalledTimes(1)
  })
})

describe('QuickAddRow added-row highlight', () => {
  const scroll = vi.fn()
  beforeEach(() => {
    scroll.mockReset()
    Element.prototype.scrollIntoView = scroll
  })

  function Harness({ ids, onSubmit }: { ids: string[]; onSubmit: Props['onSubmit'] }) {
    return (
      <table>
        <tbody>
          <QuickAddRow
            layout={LAYOUT}
            fields={FIELDS.slice(0, 1).map((f) => ({ ...f, required: true }))}
            canAdd
            label="Quick add issue"
            rowIds={ids.join(',')}
            testId="qa"
            handoff="create"
            onSubmit={onSubmit as never}
          />
          {ids.map((id) => (
            <tr key={id} data-row-key={id} data-testid={`r-${id}`}>
              <td>{id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  it('waits for the refreshed list, then scrolls to and marks the new row', async () => {
    const onSubmit = vi.fn(async (): Promise<QuickAddResult> => ({ ok: true, id: 'n1' }))
    const view = render(<Harness ids={['a']} onSubmit={onSubmit} />)
    type(title(), 'New')
    await act(async () => key(title(), 'Enter'))
    expect(scroll).not.toHaveBeenCalled()

    view.rerender(<Harness ids={['n1', 'a']} onSubmit={onSubmit} />)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('r-n1').hasAttribute('data-added')).toBe(true)
    expect(screen.getByTestId('r-a').hasAttribute('data-added')).toBe(false)

    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByTestId('r-n1').hasAttribute('data-added')).toBe(false)
  })

  it('highlights nothing when the result carries no id', async () => {
    const onSubmit = vi.fn(async (): Promise<QuickAddResult> => ({ ok: true }))
    const view = render(<Harness ids={['a']} onSubmit={onSubmit} />)
    type(title(), 'New')
    await act(async () => key(title(), 'Enter'))
    view.rerender(<Harness ids={['n1', 'a']} onSubmit={onSubmit} />)
    expect(scroll).not.toHaveBeenCalled()
    expect(document.querySelector('[data-added]')).toBeNull()
  })
})
