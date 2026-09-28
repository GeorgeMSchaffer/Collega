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
}

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
    comments: [],
    ...overrides,
  }
}

function renderForm(detail: IdeaDetail | null, contentLocked = false) {
  const onSaved = vi.fn()
  const view = render(
    <IdeaForm
      formId="idea-form"
      idea={detail}
      options={OPTIONS}
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
  it.each([
    ['Yes', 'true'],
    ['No', 'false'],
    ['', ''],
  ])('reads a stored %j as the option %j and sends it back as such', async (stored, value) => {
    const { form } = renderForm(
      idea({
        fieldValues: [
          {
            fieldDefinitionId: 'f-safety',
            name: 'Safety critical',
            fieldType: 'Boolean',
            value: stored,
          },
        ],
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
      fieldValues: [
        { fieldDefinitionId: 'f-old', name: 'Old field', fieldType: 'Text', value: 'kept' },
      ],
    })

  it('explains that the custom fields cannot be edited and will be left as they are', () => {
    renderForm(archived())
    expect(screen.getByText(/This idea type is archived/)).toBeTruthy()
    expect(screen.getByText('Kaizen fields')).toBeTruthy()
  })

  it('sends fieldValues null so the stored values are untouched', async () => {
    const { form } = renderForm(archived())
    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent().fieldValues).toBeNull()
    expect(sent().ideaTypeId).toBe('type-gone')
  })

  it('still sends the custom fields for an active type', async () => {
    const { form } = renderForm(idea())
    submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(Array.isArray(sent().fieldValues)).toBe(true)
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
      errors: { assigneeUserIds: 'An idea can have at most 5 assignees.' },
    })
    const { form } = renderForm(idea())
    submit(form)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This board is archived. Unarchive it first.')
    expect(alert.textContent).toContain('An idea can have at most 5 assignees.')
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
