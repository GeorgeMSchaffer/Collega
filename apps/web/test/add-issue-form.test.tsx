import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IssueDeliveryFields } from '@/components/delivery/issue-delivery-fields'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { Effort, IdeaFormOptions } from '@/lib/types'

/**
 * The idea form in its add-an-Issue mode (`20-feature-issues-and-delivery.md` "Backlog: add and
 * edit"): Effort and Sprint appear, Effort is required with no default, the API's field errors land
 * beside them, and the save goes through `addIssue` rather than `saveIdea`. The two server actions
 * are the boundary.
 */
const saveIdea = vi.hoisted(() => vi.fn())
const addIssue = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', () => ({ saveIdea }))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue }))

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

type Initial = { title?: string; effort?: Effort | ''; sprintId?: string }

function renderForm(props: { addingIssue?: boolean; initial?: Initial } = {}) {
  const onSaved = vi.fn()
  const view = render(
    <IdeaForm
      formId="idea-form"
      idea={null}
      options={OPTIONS}
      boards={props.addingIssue ? null : []}
      boardId={null}
      contentLocked={false}
      {...(props.addingIssue ? { addingIssue: { sprints: SPRINTS } } : {})}
      {...(props.initial ? { initial: props.initial } : {})}
      onSaved={onSaved}
      onPendingChange={() => {}}
    />,
  )
  const form = view.container.querySelector('form') as HTMLFormElement
  return { form, onSaved }
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix the dock door' } })
  fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'It jams.' } })
  fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'New track' } })
  fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'Hours.' } })
}

const effortRadio = (effort: Effort) => screen.getByRole('radio', { name: `${effort} effort` })
const sprintSelect = () => screen.getByLabelText(/^Sprint \(optional\)/) as HTMLSelectElement

beforeEach(() => {
  saveIdea.mockReset()
  addIssue.mockReset()
  saveIdea.mockResolvedValue({ ok: true, ideaId: 'idea-1' })
  addIssue.mockResolvedValue({ ok: true, ideaId: 'issue-1' })
})

describe('IdeaForm without addingIssue', () => {
  it('shows an optional Effort but no Delivery group or Sprint, and saves through saveIdea', async () => {
    const { form } = renderForm()
    expect(screen.queryByText('Delivery')).toBeNull()
    expect(screen.getAllByRole('radio')).toHaveLength(3)

    fillRequired()
    fireEvent.submit(form)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(addIssue).not.toHaveBeenCalled()
  })

  it('ignores an initial it was given about effort and sprint, and sends no effort until one is chosen', async () => {
    const { form } = renderForm({ initial: { effort: 'High', sprintId: 'sprint-1' } })
    fillRequired()
    fireEvent.submit(form)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0]).not.toHaveProperty('effort')
    expect(saveIdea.mock.calls[0]?.[0]).not.toHaveProperty('sprintId')
  })
})

describe('IdeaForm adding an Issue', () => {
  it('offers three efforts with none chosen and a Sprint defaulting to the Backlog', () => {
    renderForm({ addingIssue: true })

    for (const effort of ['Low', 'Medium', 'High'] as const) {
      expect((effortRadio(effort) as HTMLInputElement).checked).toBe(false)
    }
    expect(sprintSelect().value).toBe('')
    expect([...sprintSelect().options].map((option) => option.text)).toEqual([
      'Backlog',
      'Sprint 14 (active)',
      'Sprint 15 (planned)',
    ])
  })

  it('asks for an Effort before sending anything, beside the radios', () => {
    const { form } = renderForm({ addingIssue: true })
    fillRequired()

    fireEvent.submit(form)

    expect(screen.getByText('Choose an effort.')).toBeTruthy()
    expect(addIssue).not.toHaveBeenCalled()
    expect(saveIdea).not.toHaveBeenCalled()
    expect(effortRadio('Low').getAttribute('aria-invalid')).toBe('true')
  })

  it('moves focus to the first Effort radio when Effort is the first thing missing', () => {
    const { form } = renderForm({ addingIssue: true })
    fillRequired()

    fireEvent.submit(form)

    expect(document.activeElement).toBe(effortRadio('Low'))
  })

  it('does not ask for an Effort once one is chosen', () => {
    const { form } = renderForm({ addingIssue: true })
    fillRequired()
    fireEvent.click(effortRadio('High'))

    fireEvent.submit(form)

    expect(screen.queryByText('Choose an effort.')).toBeNull()
  })

  it('submits the effort and sprint through addIssue, with the board left out', async () => {
    const { form, onSaved } = renderForm({ addingIssue: true })
    fillRequired()
    fireEvent.click(effortRadio('Medium'))
    fireEvent.change(sprintSelect(), { target: { value: 'sprint-2' } })

    fireEvent.submit(form)

    await waitFor(() => expect(addIssue).toHaveBeenCalled())
    expect(saveIdea).not.toHaveBeenCalled()
    const sent = addIssue.mock.calls[0]?.[0]
    expect(sent).toMatchObject({
      title: 'Fix the dock door',
      problem: 'It jams.',
      proposedSolutions: ['New track'],
      ideaTypeId: 'type-1',
      businessImpactId: 'impact-1',
      effort: 'Medium',
      sprintId: 'sprint-2',
    })
    expect(sent).not.toHaveProperty('boardId')
    expect(sent).not.toHaveProperty('ideaId')
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('issue-1', 'sprint-2'))
  })

  it('sends an empty sprint for the Backlog and reports it to onSaved as empty', async () => {
    const { form, onSaved } = renderForm({ addingIssue: true })
    fillRequired()
    fireEvent.click(effortRadio('Low'))

    fireEvent.submit(form)

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('issue-1', ''))
    expect(addIssue.mock.calls[0]?.[0]).toMatchObject({ effort: 'Low', sprintId: '' })
  })

  it('puts the API’s effort and sprint errors beside their controls, not in the top alert', async () => {
    addIssue.mockResolvedValue({
      ok: false,
      error: null,
      errors: { effort: 'Effort must be Low, Medium or High.', sprintId: 'That sprint is closed.' },
    })
    const { form, onSaved } = renderForm({ addingIssue: true })
    fillRequired()
    fireEvent.click(effortRadio('Low'))

    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('That sprint is closed.')).toBeTruthy())
    expect(screen.getByText('Effort must be Low, Medium or High.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(sprintSelect().getAttribute('aria-invalid')).toBe('true')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('shows a refusal with no field errors in the alert above the form', async () => {
    addIssue.mockResolvedValue({
      ok: false,
      error: 'Read Only members cannot add issues.',
      errors: {},
    })
    const { form } = renderForm({ addingIssue: true })
    fillRequired()
    fireEvent.click(effortRadio('Low'))

    fireEvent.submit(form)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Read Only members cannot add issues.')
  })

  it('lists an error keyed to a field the form does not show above the form', async () => {
    addIssue.mockResolvedValue({ ok: false, error: null, errors: { nonsense: 'Odd.' } })
    const { form } = renderForm({ addingIssue: true })
    fillRequired()
    fireEvent.click(effortRadio('Low'))

    fireEvent.submit(form)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Odd.')
  })
})

describe('IdeaForm initial values when adding an Issue', () => {
  it('starts with the title, effort and sprint it was given', () => {
    renderForm({
      addingIssue: true,
      initial: { title: 'From quick add', effort: 'High', sprintId: 'sprint-1' },
    })

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('From quick add')
    expect((effortRadio('High') as HTMLInputElement).checked).toBe(true)
    expect(sprintSelect().value).toBe('sprint-1')
  })

  it('submits the prefilled values without the person touching them', async () => {
    const { form } = renderForm({
      addingIssue: true,
      initial: { title: 'From quick add', effort: 'High', sprintId: 'sprint-1' },
    })
    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'P' } })
    fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'R' } })

    fireEvent.submit(form)

    await waitFor(() => expect(addIssue).toHaveBeenCalled())
    expect(addIssue.mock.calls[0]?.[0]).toMatchObject({
      title: 'From quick add',
      effort: 'High',
      sprintId: 'sprint-1',
    })
  })

  it('is unchanged when initial is absent: empty title, no effort, Backlog', () => {
    renderForm({ addingIssue: true })

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('')
    expect(screen.queryAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toEqual(
      [],
    )
    expect(sprintSelect().value).toBe('')
  })

  it('treats an empty effort in initial as none chosen', () => {
    renderForm({ addingIssue: true, initial: { title: 'T', effort: '' } })
    expect(screen.queryAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toEqual(
      [],
    )
  })
})

describe('IssueDeliveryFields', () => {
  function renderFields(overrides: Partial<Parameters<typeof IssueDeliveryFields>[0]> = {}): {
    onEffort: ReturnType<typeof vi.fn>
    onSprint: ReturnType<typeof vi.fn>
  } {
    const onEffort = vi.fn()
    const onSprint = vi.fn()
    render(
      <IssueDeliveryFields
        effort=""
        sprintId=""
        sprints={SPRINTS}
        errors={{}}
        onEffort={onEffort}
        onSprint={onSprint}
        {...overrides}
      />,
    )
    return { onEffort, onSprint }
  }

  it('reports the effort picked', () => {
    const { onEffort } = renderFields()
    fireEvent.click(effortRadio('High'))
    expect(onEffort).toHaveBeenCalledExactlyOnceWith('High')
  })

  it('reports the sprint picked, and the Backlog as empty', () => {
    const { onSprint } = renderFields({ sprintId: 'sprint-1' })
    fireEvent.change(sprintSelect(), { target: { value: '' } })
    expect(onSprint).toHaveBeenCalledExactlyOnceWith('')
  })

  it('reflects the controlled effort and sprint', () => {
    renderFields({ effort: 'Medium', sprintId: 'sprint-2' })
    expect((effortRadio('Medium') as HTMLInputElement).checked).toBe(true)
    expect(sprintSelect().value).toBe('sprint-2')
  })

  it('lists only the sprints it is given, after Backlog', () => {
    renderFields({ sprints: [SPRINTS[1] as (typeof SPRINTS)[number]] })
    expect([...sprintSelect().options].map((option) => option.value)).toEqual(['', 'sprint-2'])
  })

  it('shows the effort error by its key and marks the radios invalid', () => {
    renderFields({ errors: { effort: 'Choose an effort.' } })
    expect(screen.getByText('Choose an effort.')).toBeTruthy()
    for (const effort of ['Low', 'Medium', 'High'] as const) {
      expect(effortRadio(effort).getAttribute('aria-invalid')).toBe('true')
    }
  })

  it('shows the sprint error by its key and leaves the radios valid', () => {
    renderFields({ errors: { sprintId: 'Sprint not found.' } })
    expect(screen.getByText('Sprint not found.')).toBeTruthy()
    expect(sprintSelect().getAttribute('aria-invalid')).toBe('true')
    expect(effortRadio('Low').getAttribute('aria-invalid')).toBeNull()
  })

  it('shows no error text when there is none', () => {
    renderFields()
    expect(screen.queryByText('Choose an effort.')).toBeNull()
    expect(sprintSelect().getAttribute('aria-invalid')).toBeNull()
  })
})
