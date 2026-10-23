import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddIssueButton, BacklogAdd, RowEditButton } from '@/components/delivery/backlog-add'
import type { IdeaFormOptions } from '@/lib/types'

/**
 * The Backlog's create drawer (`20-feature-issues-and-delivery.md` "Backlog: add and edit"): it
 * opens from `?new`, the footer's Add issue submits the form, and a save confirms with a toast,
 * highlights only a row that landed on the Backlog, and moves the URL to the new Issue. The router
 * and the server actions are the boundary.
 */
const nav = vi.hoisted(() => ({
  push: vi.fn(),
  params: new URLSearchParams(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/delivery/backlog',
  useSearchParams: () => nav.params,
}))
const addIssue = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue }))
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  saveIdea: vi.fn(),
}))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-1', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-1', name: 'Medium' }],
  members: [],
  tags: [],
}
const SPRINTS = [
  { id: 'sprint-1', name: 'Sprint 14', state: 'Active' as const },
  { id: 'sprint-2', name: 'Sprint 15', state: 'Planned' as const },
]

const scrollIntoView = vi.fn()

beforeEach(() => {
  nav.push.mockReset()
  nav.params = new URLSearchParams()
  addIssue.mockReset()
  addIssue.mockResolvedValue({ ok: true, ideaId: 'issue-1' })
  scrollIntoView.mockReset()
  Element.prototype.scrollIntoView = scrollIntoView
})

function renderDrawer(
  props: Partial<Parameters<typeof BacklogAdd>[0]> = {},
  { withRow = false }: { withRow?: boolean } = {},
) {
  const tree = (rowIds: string) => (
    <>
      {withRow ? <div data-row-key="issue-1" /> : null}
      <BacklogAdd options={OPTIONS} sprints={SPRINTS} rowIds={rowIds} {...props} />
    </>
  )
  const view = render(tree(''))
  return { ...view, rerenderRows: (rowIds: string) => view.rerender(tree(rowIds)) }
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix the dock door' } })
  fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'It jams.' } })
  fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'New track' } })
  fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'Hours.' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Low effort' }))
}

const addButton = () => screen.getByRole('button', { name: /^(Add issue|Adding issue…)$/ })

describe('BacklogAdd drawer', () => {
  it('renders no form while closed, since the page reads the catalogs only when asked', () => {
    renderDrawer({ options: null })
    expect(screen.queryByLabelText('Title')).toBeNull()
  })

  it('renders the Issue form with Effort and Sprint and no Board when open', () => {
    renderDrawer()
    expect(screen.getByText('Add New Issue')).toBeTruthy()
    expect(screen.getByLabelText('Title')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'High effort' })).toBeTruthy()
    expect(screen.getByLabelText(/^Sprint \(optional\)/)).toBeTruthy()
    expect(screen.queryByLabelText('Board')).toBeNull()
  })

  it('offers the sprints it is given', () => {
    renderDrawer()
    const select = screen.getByLabelText(/^Sprint \(optional\)/) as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual(['', 'sprint-1', 'sprint-2'])
  })

  it('submits the form from the footer’s Add issue button, which sits outside it', async () => {
    renderDrawer()
    fillRequired()

    fireEvent.click(addButton())

    await waitFor(() => expect(addIssue).toHaveBeenCalledOnce())
    expect(addIssue.mock.calls[0]?.[0]).toMatchObject({
      title: 'Fix the dock door',
      effort: 'Low',
      sprintId: '',
    })
  })

  it('does not call the server when a required field is missing', () => {
    renderDrawer()
    fireEvent.click(addButton())
    expect(addIssue).not.toHaveBeenCalled()
    expect(screen.getByText('Title is required.')).toBeTruthy()
    expect(screen.getByText('Choose an effort.')).toBeTruthy()
  })

  it('disables the button and says "Adding issue…" while the save is in flight', async () => {
    let finish: (value: unknown) => void = () => {}
    addIssue.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderDrawer()
    fillRequired()

    fireEvent.click(addButton())

    await waitFor(() => expect(addButton().textContent).toBe('Adding issue…'))
    expect((addButton() as HTMLButtonElement).disabled).toBe(true)

    await act(async () => finish({ ok: true, ideaId: 'issue-1' }))
    await waitFor(() => expect(addButton().textContent).toBe('Add issue'))
  })

  it('closes by dropping ?new and keeping the list’s own parameters on Cancel', () => {
    nav.params = new URLSearchParams('new=1&status=Open')
    renderDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/delivery/backlog?status=Open', {
      scroll: false,
    })
  })

  it('stays open and shows the refusal when the save is refused', async () => {
    addIssue.mockResolvedValue({ ok: false, error: 'Nope.', errors: {} })
    renderDrawer()
    fillRequired()

    fireEvent.click(addButton())

    expect((await screen.findByRole('alert')).textContent).toContain('Nope.')
    expect(nav.push).not.toHaveBeenCalled()
    expect(screen.queryByText('Issue added')).toBeNull()
  })
})

describe('BacklogAdd after a save', () => {
  it('confirms a Backlog add with "Issue added" and closes back to the Backlog', async () => {
    nav.params = new URLSearchParams('new=1&status=Open')
    renderDrawer()
    fillRequired()

    fireEvent.click(addButton())

    expect(await screen.findByText('Issue added')).toBeTruthy()
    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/delivery/backlog?status=Open', {
      scroll: false,
    })
  })

  it('names the sprint in the toast when the Issue was put in one', async () => {
    renderDrawer()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/^Sprint \(optional\)/), {
      target: { value: 'sprint-2' },
    })

    fireEvent.click(addButton())

    expect(await screen.findByText('Issue added to Sprint 15')).toBeTruthy()
    expect(screen.queryByText('Issue added')).toBeNull()
  })

  it('closes the drawer too when the Issue went into a sprint', async () => {
    renderDrawer()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/^Sprint \(optional\)/), {
      target: { value: 'sprint-1' },
    })

    fireEvent.click(addButton())

    await waitFor(() => expect(nav.push).toHaveBeenCalled())
    expect(nav.push.mock.calls[0]?.[0]).toBe('/delivery/backlog')
  })

  it('highlights and scrolls to the new row when it landed on the Backlog', async () => {
    const view = renderDrawer({}, { withRow: true })
    fillRequired()

    fireEvent.click(addButton())
    await screen.findByText('Issue added')
    view.rerenderRows('issue-1')

    const row = document.querySelector('[data-row-key="issue-1"]') as HTMLElement
    await waitFor(() => expect(row.dataset.added).toBe(''))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('does not highlight anything when the Issue went into a sprint, since it is not in this list', async () => {
    const view = renderDrawer({}, { withRow: true })
    fillRequired()
    fireEvent.change(screen.getByLabelText(/^Sprint \(optional\)/), {
      target: { value: 'sprint-1' },
    })

    fireEvent.click(addButton())
    await screen.findByText('Issue added to Sprint 14')
    view.rerenderRows('issue-1')

    const row = document.querySelector('[data-row-key="issue-1"]') as HTMLElement
    expect(row.dataset.added).toBeUndefined()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('BacklogAdd prefill from the quick-add row', () => {
  const prefill = { title: 'Quick title', effort: 'High' as const, sprintId: 'sprint-1' }

  it('starts the form with the prefilled values', () => {
    renderDrawer({ prefill, onPrefillApplied: vi.fn() })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Quick title')
    expect((screen.getByRole('radio', { name: 'High effort' }) as HTMLInputElement).checked).toBe(
      true,
    )
    expect((screen.getByLabelText(/^Sprint \(optional\)/) as HTMLSelectElement).value).toBe(
      'sprint-1',
    )
  })

  it('reports the prefill spent once the form is open, so a later open starts empty', () => {
    const onPrefillApplied = vi.fn()
    renderDrawer({ prefill, onPrefillApplied })
    expect(onPrefillApplied).toHaveBeenCalled()
  })

  it('keeps the prefill until the catalogs have arrived and the form is mounted', () => {
    const onPrefillApplied = vi.fn()
    renderDrawer({ options: null, prefill, onPrefillApplied })
    expect(onPrefillApplied).not.toHaveBeenCalled()
  })

  it('starts empty when there is no prefill', () => {
    renderDrawer()
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('')
  })
})

describe('AddIssueButton', () => {
  it('is labelled "Add New Issue" by default', () => {
    render(<AddIssueButton />)
    expect(screen.getByRole('button', { name: 'Add New Issue' })).toBeTruthy()
  })

  it('takes another label for the empty state', () => {
    render(<AddIssueButton label="Add issue" />)
    expect(screen.getByRole('button', { name: 'Add issue' })).toBeTruthy()
  })

  it('opens the drawer by adding ?new and keeping the list’s parameters', () => {
    nav.params = new URLSearchParams('status=Open&idea=old&edit=1')
    render(<AddIssueButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Add New Issue' }))

    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/delivery/backlog?status=Open&new=1', {
      scroll: false,
    })
  })
})

describe('RowEditButton', () => {
  it('names the Issue it edits', () => {
    render(<RowEditButton ideaId="i-7" title="Fix the dock door" />)
    expect(screen.getByRole('button', { name: 'Edit Fix the dock door' })).toBeTruthy()
  })

  it('opens that Issue’s edit form in the drawer', () => {
    render(<RowEditButton ideaId="i-7" title="Fix the dock door" />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Fix the dock door' }))

    expect(nav.push).toHaveBeenCalledExactlyOnceWith('/delivery/backlog?idea=i-7&edit=1', {
      scroll: false,
    })
  })
})
