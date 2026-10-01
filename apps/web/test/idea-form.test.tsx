import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { IdeaDetail, IdeaFormOptions } from '@/lib/types'

/**
 * The idea drawer's form (`20-feature-ideas-and-engagement.md` rule 2a): what it sends, and where
 * the API's field-keyed refusals land. The server action is the boundary and is replaced here.
 */
const saveIdea = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', () => ({ saveIdea }))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [
    {
      id: 'type-ci',
      name: 'Continuous Improvement',
      fields: [
        {
          id: 'f-safety',
          name: 'Safety critical',
          fieldType: 'Boolean',
          required: false,
          options: [],
        },
        { id: 'f-site', name: 'Site', fieldType: 'Text', required: false, options: [] },
      ],
    },
  ],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
}

const TYPE_FIELDS = OPTIONS.ideaTypes[0]?.fields ?? []

function idea(overrides: Partial<IdeaDetail> = {}): IdeaDetail {
  return {
    id: 'idea-1',
    boardId: 'board-1',
    statusId: 'status-1',
    statusName: 'New',
    title: 'Reduce changeover time',
    priority: 'Medium',
    ideaType: 'Continuous Improvement',
    businessImpact: 'Medium',
    tag: null,
    tags: [],
    assigneeInitials: null,
    assignees: [],
    upvotes: 0,
    hasUpvoted: false,
    effort: null,
    problem: 'Changeovers take two hours.',
    proposedSolutions: ['Pre-stage tooling'],
    impactRationale: 'Six hours a week of idle line.',
    description: null,
    ideaTypeId: 'type-ci',
    businessImpactId: 'impact-med',
    dueDate: null,
    authorUserId: 'author-1',
    author: null,
    createdOn: '27 Sep 2026',
    mentionEmails: [],
    fieldValues: [],
    formFields: TYPE_FIELDS.map((field) => ({ ...field, value: '' })),
    comments: [],
    ...overrides,
  }
}

function renderForm(detail: IdeaDetail | null, contentLocked = false, options = OPTIONS) {
  const onSaved = vi.fn()
  const view = render(
    <IdeaForm
      formId="idea-form"
      idea={detail}
      options={options}
      boards={null}
      boardId="board-1"
      contentLocked={contentLocked}
      onSaved={onSaved}
      onPendingChange={() => {}}
    />,
  )
  const form = view.container.querySelector('form') as HTMLFormElement
  return { form, onSaved }
}

const submit = (form: HTMLFormElement) => fireEvent.submit(form)
const sent = () => saveIdea.mock.calls[0]?.[0]

beforeEach(() => {
  saveIdea.mockReset()
  saveIdea.mockResolvedValue({ ok: true, ideaId: 'idea-1' })
})

describe('IdeaForm Boolean custom field', () => {
  it.each(['true', 'false', ''])('reads a stored %j and sends it back unchanged', async (value) => {
    const { form } = renderForm(
      idea({
        formFields: TYPE_FIELDS.map((field) => ({
          ...field,
          value: field.id === 'f-safety' ? value : '',
        })),
      }),
    )
    const select = screen.getByLabelText('Safety critical (optional)') as HTMLSelectElement
    expect(select.value).toBe(value)

    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent().fieldValues).toContainEqual({ fieldDefinitionId: 'f-safety', value })
  })

  it('offers Yes and No and sends the choice as true or false', async () => {
    const { form } = renderForm(idea())
    const select = screen.getByLabelText('Safety critical (optional)') as HTMLSelectElement
    expect([...select.options].map((option) => option.text)).toEqual(['Choose…', 'Yes', 'No'])

    fireEvent.change(select, { target: { value: 'false' } })
    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent().fieldValues).toContainEqual({ fieldDefinitionId: 'f-safety', value: 'false' })
  })
})

describe('IdeaForm with an archived Idea Type', () => {
  const archived = () =>
    idea({
      ideaTypeId: 'type-gone',
      ideaType: 'Kaizen',
      formFields: [
        {
          id: 'f-old',
          name: 'Old field',
          fieldType: 'Text',
          required: false,
          options: [],
          value: 'kept',
        },
      ],
    })

  it("shows the idea's own fields, editable, although the catalog no longer lists the type", () => {
    renderForm(archived())
    expect(screen.getByText('Kaizen fields')).toBeTruthy()
    const input = screen.getByLabelText('Old field (optional)') as HTMLInputElement
    expect(input.value).toBe('kept')
    expect(input.readOnly).toBe(false)
  })

  it('sends its fields back, edited', async () => {
    const { form } = renderForm(archived())
    fireEvent.change(screen.getByLabelText('Old field (optional)'), { target: { value: 'moved' } })
    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent().fieldValues).toEqual([{ fieldDefinitionId: 'f-old', value: 'moved' }])
    expect(sent().ideaTypeId).toBe('type-gone')
  })
})

describe('IdeaForm choice fields', () => {
  const withChoices = () =>
    idea({
      formFields: [
        {
          id: 'f-areas',
          name: 'Areas',
          fieldType: 'MultiSelect',
          required: false,
          options: [
            { id: 'o-weld', label: 'Welding, cutting', archived: false },
            { id: 'o-paint', label: 'Paint', archived: false },
            { id: 'o-gone', label: 'o-gone', archived: true },
          ],
          value: 'o-weld,o-gone',
        },
      ],
    })

  it('sends stored option ids back unchanged, a label with a comma included', async () => {
    const { form } = renderForm(withChoices())
    expect((screen.getByLabelText('Welding, cutting') as HTMLInputElement).checked).toBe(true)
    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent().fieldValues).toEqual([{ fieldDefinitionId: 'f-areas', value: 'o-weld,o-gone' }])
  })

  it('shows an archived option only while it is selected', () => {
    renderForm(withChoices())
    const archivedOption = screen.getByLabelText('o-gone (archived)') as HTMLInputElement
    expect(archivedOption.checked).toBe(true)

    fireEvent.click(archivedOption)
    expect(screen.queryByLabelText('o-gone (archived)')).toBeNull()
    expect(screen.getByLabelText('Paint')).toBeTruthy()
  })
})

describe('IdeaForm API errors', () => {
  it('puts each field-keyed 400 beside its control, custom fields by name', async () => {
    saveIdea.mockResolvedValue({
      ok: false,
      error: null,
      errors: {
        problem: 'Problem must be 2000 characters or fewer.',
        proposedSolutions: 'A proposed solution must fit on one line.',
        Site: 'Site must be a real site.',
      },
    })
    const { form } = renderForm(idea())
    submit(form)

    const problem = await screen.findByText('Problem must be 2000 characters or fewer.')
    expect(screen.getByLabelText('Problem').getAttribute('aria-invalid')).toBe('true')
    expect(problem.closest('[role="alert"]')).toBeNull()

    expect(screen.getByText('A proposed solution must fit on one line.')).toBeTruthy()
    expect(screen.getByLabelText('Solution 1').getAttribute('aria-invalid')).toBe('true')

    expect(screen.getByText('Site must be a real site.').closest('[role="alert"]')).toBeNull()
    expect(screen.getByLabelText('Site (optional)').getAttribute('aria-invalid')).toBe('true')

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lists a key the form does not place, and the general message, in the top alert', async () => {
    saveIdea.mockResolvedValue({
      ok: false,
      error: 'This board is archived. Unarchive it first.',
      errors: { statusId: 'That status is not available.' },
    })
    const { form } = renderForm(idea())
    submit(form)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This board is archived. Unarchive it first.')
    expect(alert.textContent).toContain('That status is not available.')
  })

  it('does not call the API while a required structured field is empty', () => {
    const { form } = renderForm(
      idea({ problem: '', impactRationale: ' ', proposedSolutions: [''] }),
    )
    submit(form)
    expect(saveIdea).not.toHaveBeenCalled()
    expect(screen.getByText('Problem is required.')).toBeTruthy()
    expect(screen.getByText('Impact Rationale is required.')).toBeTruthy()
    expect(screen.getByText('Add at least one proposed solution.')).toBeTruthy()
  })
})

describe('IdeaForm structured fields for a reader who is neither author nor Org Admin', () => {
  it('shows Problem, the solutions, Impact rationale and Summary read-only, with the reason', () => {
    renderForm(idea({ proposedSolutions: ['Pre-stage tooling', 'Quick-release clamps'] }), true)

    for (const label of ['Problem', 'Impact rationale', 'Summary (optional)']) {
      expect((screen.getByLabelText(label) as HTMLTextAreaElement).readOnly).toBe(true)
    }
    expect((screen.getByLabelText('Solution 1') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByLabelText('Solution 2') as HTMLInputElement).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: '+ Add a solution' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Remove solution/ })).toBeNull()
    expect(
      screen.getAllByText('Only the author or an Org Admin can change this.').length,
    ).toBeGreaterThan(0)
    // The rest of the form stays editable.
    expect((screen.getByLabelText('Title') as HTMLInputElement).readOnly).toBe(false)
  })

  it('sends the locked fields back unchanged', async () => {
    const { form } = renderForm(idea(), true)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New title' } })
    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent()).toMatchObject({
      title: 'New title',
      problem: 'Changeovers take two hours.',
      proposedSolutions: ['Pre-stage tooling'],
      impactRationale: 'Six hours a week of idle line.',
    })
  })

  it('leaves the structured fields editable for the author or an Org Admin', () => {
    renderForm(idea(), false)
    expect((screen.getByLabelText('Problem') as HTMLTextAreaElement).readOnly).toBe(false)
    expect(screen.getByRole('button', { name: '+ Add a solution' })).toBeTruthy()
  })
})

describe('IdeaForm classification defaults', () => {
  // Active-only, in sort order, as the options arrive from the catalog readers.
  const CATALOG: IdeaFormOptions = {
    ideaTypes: [
      {
        id: 'type-kaizen',
        name: 'Kaizen',
        fields: [{ id: 'f-line', name: 'Line', fieldType: 'Text', required: false, options: [] }],
      },
      ...OPTIONS.ideaTypes,
    ],
    businessImpacts: [{ id: 'impact-high', name: 'High' }, ...OPTIONS.businessImpacts],
    members: [],
  }
  const typeSelect = () => screen.getByLabelText('Idea type') as HTMLSelectElement
  const impactSelect = () => screen.getByLabelText('Business impact') as HTMLSelectElement

  it('preselects the first Idea Type and Business Impact on a new idea', () => {
    renderForm(null, false, CATALOG)

    expect(typeSelect().value).toBe('type-kaizen')
    expect(impactSelect().value).toBe('impact-high')
  })

  it("shows the preselected type's custom fields without a pick", () => {
    renderForm(null, false, CATALOG)

    expect(screen.getByText('Kaizen fields')).toBeTruthy()
    expect(screen.getByLabelText('Line (optional)')).toBeTruthy()
    expect(screen.queryByText('Pick an Idea Type to see its custom fields.')).toBeNull()
  })

  it('sends the preselected ids when saved untouched', async () => {
    const { form } = renderForm(null, false, CATALOG)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Shorter changeovers' } })
    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Two hours each.' } })
    fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'Pre-stage.' } })
    fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'Idle line.' } })

    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent()).toMatchObject({ ideaTypeId: 'type-kaizen', businessImpactId: 'impact-high' })
  })

  it("keeps an edited idea's own Idea Type and Business Impact", () => {
    renderForm(idea(), false, CATALOG)

    expect(typeSelect().value).toBe('type-ci')
    expect(impactSelect().value).toBe('impact-med')
    expect(screen.getByText('Continuous Improvement fields')).toBeTruthy()
  })

  it('leaves both unchosen when the catalogs are empty', () => {
    renderForm(null, false, { ideaTypes: [], businessImpacts: [], members: [] })

    expect(typeSelect().value).toBe('')
    expect(impactSelect().value).toBe('')
    expect(screen.getByText('Pick an Idea Type to see its custom fields.')).toBeTruthy()
  })
})
