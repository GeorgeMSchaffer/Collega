import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { BoardRef, IdeaDetail, IdeaFormOptions } from '@/lib/types'

/**
 * Effort on the new-idea form (slice 301): shown on create as on edit, optional, with the
 * reference-lane helper on boards that have one, a server `effort` error beside the field, and
 * never on a task.
 */
const saveIdea = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  saveIdea,
}))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue: vi.fn() }))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}
const BOARDS: BoardRef[] = [
  { id: 'b-plain', name: 'Assembly', isArchived: false, hasReferenceLane: false },
  { id: 'b-ref', name: 'Planning', isArchived: false, hasReferenceLane: true },
]
const HELPER = /Needed before this idea can move into a reference lane/

function form(props: Partial<React.ComponentProps<typeof IdeaForm>> = {}) {
  const view = render(
    <IdeaForm
      formId="f"
      idea={null}
      options={OPTIONS}
      boards={BOARDS}
      boardId={null}
      contentLocked={false}
      onSaved={() => {}}
      onPendingChange={() => {}}
      {...props}
    />,
  )
  return view.container.querySelector('form') as HTMLFormElement
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Shorter changeovers' } })
  fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Two hours each.' } })
  fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'Pre-stage.' } })
  fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'Idle line.' } })
}

const radio = (name: RegExp) => screen.getByRole('radio', { name }) as HTMLInputElement
const sent = () => saveIdea.mock.calls[0]?.[0]

/** A task: it has a parent idea. Only the fields the form reads matter here. */
function task(): IdeaDetail {
  return {
    id: 't-1',
    boardId: 'b-impl',
    parentIdeaId: 'p-1',
    effort: null,
    title: 'A task',
    problem: 'p',
    proposedSolutions: ['s'],
    impactRationale: 'r',
    description: null,
    priority: 'Medium',
    ideaTypeId: 'type-ci',
    businessImpactId: 'impact-med',
    dueDate: null,
    tags: [],
    assignees: [],
    mentionEmails: [],
    fieldValues: [],
    formFields: [],
  } as unknown as IdeaDetail
}

beforeEach(() => {
  saveIdea.mockReset()
  saveIdea.mockResolvedValue({ ok: true, ideaId: 'new-1' })
})

describe('IdeaForm Effort on create', () => {
  it('offers Low, Medium and High on a new idea, none chosen', () => {
    form()

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.value)).toEqual(['Low', 'Medium', 'High'])
    expect(radios.some((r) => r.checked)).toBe(false)
  })

  it('creates without an effort when none is chosen', async () => {
    const f = form()
    fillRequired()
    fireEvent.submit(f)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect('effort' in sent()).toBe(false)
  })

  it('sends the chosen effort on create', async () => {
    const f = form()
    fillRequired()
    fireEvent.click(radio(/Medium/))
    fireEvent.submit(f)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(sent()).toMatchObject({ ideaId: null, effort: 'Medium' })
  })

  it('sends no effort after a choice is cleared again', async () => {
    const f = form()
    fillRequired()
    fireEvent.click(radio(/High/))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.submit(f)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect('effort' in sent()).toBe(false)
  })
})

describe('IdeaForm Effort on edit', () => {
  it('sends null when a stored effort is cleared, and nothing when it is untouched', async () => {
    const stored = { ...task(), parentIdeaId: null, effort: 'High' } as unknown as IdeaDetail
    const first = form({ idea: stored })
    expect(radio(/High/).checked).toBe(true)
    fireEvent.submit(first)
    await waitFor(() => expect(saveIdea).toHaveBeenCalledTimes(1))
    expect('effort' in sent()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.submit(first)
    await waitFor(() => expect(saveIdea).toHaveBeenCalledTimes(2))
    expect(saveIdea.mock.calls[1]?.[0]).toMatchObject({ effort: null })
  })
})

describe('IdeaForm Effort helper', () => {
  it('says Optional with no board', () => {
    form()

    expect(screen.getByText('Optional.')).toBeTruthy()
    expect(screen.queryByText(HELPER)).toBeNull()
  })

  it('says Optional on a board with no reference lane', () => {
    form({ boardId: 'b-plain' })

    expect(screen.getByText('Optional.')).toBeTruthy()
    expect(screen.queryByText(HELPER)).toBeNull()
  })

  it('explains the reference-lane gate on a board that has one', () => {
    form({ boardId: 'b-ref' })

    expect(screen.getByText(HELPER)).toBeTruthy()
    expect(screen.queryByText('Optional.')).toBeNull()
  })

  it('follows the Board select as it changes', () => {
    form({ boardId: 'b-plain' })
    const board = screen.getByLabelText(/^Board/)

    fireEvent.change(board, { target: { value: 'b-ref' } })
    expect(screen.getByText(HELPER)).toBeTruthy()

    fireEvent.change(board, { target: { value: 'b-plain' } })
    expect(screen.queryByText(HELPER)).toBeNull()
  })

  it('uses the helper when the caller says the board has a reference lane', () => {
    form({ boards: null, boardId: 'b-ref', referenceLane: true })

    expect(screen.getByText(HELPER)).toBeTruthy()
  })
})

describe('IdeaForm Effort server error', () => {
  it('shows a refused effort beside the field, not in the top alert', async () => {
    saveIdea.mockResolvedValue({
      ok: false,
      error: null,
      errors: { effort: 'Effort must be Low, Medium or High.' },
    })
    const f = form()
    fillRequired()
    fireEvent.click(radio(/Low/))
    fireEvent.submit(f)

    const message = await screen.findByText('Effort must be Low, Medium or High.')
    expect(message.closest('[role="alert"]')).toBeNull()
    expect(screen.queryByText('Optional.')).toBeNull()
    expect(radio(/Low/).getAttribute('aria-invalid')).toBe('true')
  })

  it('clears the error once another level is chosen', async () => {
    saveIdea.mockResolvedValue({ ok: false, error: null, errors: { effort: 'Bad effort.' } })
    const f = form()
    fillRequired()
    fireEvent.click(radio(/Low/))
    fireEvent.submit(f)
    await screen.findByText('Bad effort.')

    fireEvent.click(radio(/High/))

    expect(screen.queryByText('Bad effort.')).toBeNull()
  })
})

describe('IdeaForm Effort on a task', () => {
  it('shows no Effort field for a task', () => {
    form({ idea: task(), boardId: 'b-impl' })

    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('does not send effort when a task is saved', async () => {
    const f = form({ idea: task(), boardId: 'b-impl' })
    fireEvent.submit(f)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect('effort' in sent()).toBe(false)
  })
})
