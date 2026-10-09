import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { IdeaFormOptions } from '@/lib/types'

/**
 * The Tags combobox (`SPEC/decisions.md` 2026-10-04): one Enter turns typed text into a chip,
 * taking the highlighted option or, with none highlighted, the first. It never submits the form.
 */
const saveIdea = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', () => ({ saveIdea }))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [
    { id: 't-safety', name: 'safety', color: '#c0392b' },
    { id: 't-saving', name: 'savings', color: '#27ae60' },
  ],
}

function renderForm() {
  const view = render(
    <IdeaForm
      formId="idea-form"
      idea={null}
      options={OPTIONS}
      boards={null}
      boardId="board-1"
      contentLocked={false}
      onSaved={() => {}}
      onPendingChange={() => {}}
    />,
  )
  return view.container.querySelector('form') as HTMLFormElement
}

const tagInput = () => screen.getByLabelText('Tags (optional)') as HTMLInputElement
const type = (text: string) => fireEvent.change(tagInput(), { target: { value: text } })
const enter = () => fireEvent.keyDown(tagInput(), { key: 'Enter' })
const chips = () => screen.queryAllByRole('button', { name: /^Remove (?!solution)/ })

function fillRequired() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Shorter changeovers' } })
  fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Two hours each.' } })
  fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'Pre-stage.' } })
  fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'Idle line.' } })
}

beforeEach(() => {
  saveIdea.mockReset()
  saveIdea.mockResolvedValue({ ok: true, ideaId: 'idea-1' })
})

describe('Tags: one Enter adds a tag', () => {
  it('adds the first matching tag when nothing is highlighted', () => {
    renderForm()
    type('sa')
    enter()

    expect(screen.getByRole('button', { name: 'Remove safety' })).toBeTruthy()
    expect(tagInput().value).toBe('')
  })

  it('adds the highlighted option instead of the first once arrowed to', () => {
    renderForm()
    type('sa')
    fireEvent.keyDown(tagInput(), { key: 'ArrowDown' })
    fireEvent.keyDown(tagInput(), { key: 'ArrowDown' })
    enter()

    expect(screen.getByRole('button', { name: 'Remove savings' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove safety' })).toBeNull()
  })

  it('creates a new tag from text nothing matches', () => {
    renderForm()
    type('brand-new')
    enter()

    expect(screen.getByRole('button', { name: 'Remove brand-new' })).toBeTruthy()
    expect(tagInput().value).toBe('')
  })

  it('does not suggest or add anything from a single character', () => {
    renderForm()
    type('s')
    enter()

    expect(chips()).toHaveLength(0)
    expect(tagInput().value).toBe('s')
  })

  it('does not offer a tag already chosen', () => {
    renderForm()
    type('safety')
    enter()
    type('safety')
    enter()

    expect(chips()).toHaveLength(1)
  })

  it('never submits the form', () => {
    renderForm()
    type('sa')
    enter()

    expect(saveIdea).not.toHaveBeenCalled()
  })

  it('sends the tag added with Enter when the idea is saved', async () => {
    const form = renderForm()
    fillRequired()
    type('brand-new')
    enter()
    fireEvent.submit(form)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0].tagNames).toEqual(['brand-new'])
  })
})

describe('Tags: text left in the box', () => {
  it('refuses the save and says to press Enter or clear it', async () => {
    const form = renderForm()
    fillRequired()
    type('leftover')
    fireEvent.submit(form)

    expect(
      await screen.findByText("Press Enter in Tags to add 'leftover', or clear the text."),
    ).toBeTruthy()
    expect(saveIdea).not.toHaveBeenCalled()
  })

  it('lets the save through once Enter has turned the text into a chip', async () => {
    const form = renderForm()
    fillRequired()
    type('leftover')
    enter()
    fireEvent.submit(form)

    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
  })
})
