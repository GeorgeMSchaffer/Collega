import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { IdeaForm, type IdeaFormAssist } from '@/components/ideas/idea-form'
import type { IdeaFormOptions } from '@/lib/types'

/**
 * The create form's handle for the idea assistant (slice 309): what `read` sends each turn
 * (`lockedFields`), what `apply` marks Suggested and when the mark clears, and where `place`
 * puts the text of a failed turn.
 */
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  saveIdea: vi.fn(),
}))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue: vi.fn() }))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [
    {
      id: 'type-ci',
      name: 'Continuous Improvement',
      fields: [
        {
          id: 'field-budget',
          name: 'Budget',
          fieldType: 'Text',
          isRequired: false,
          options: [],
        } as never,
      ],
    },
  ],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}

function mount() {
  const assist = createRef<IdeaFormAssist>()
  render(
    <IdeaForm
      formId="f"
      idea={null}
      options={OPTIONS}
      boards={null}
      boardId={null}
      contentLocked={false}
      assistRef={assist}
      onSaved={() => {}}
      onPendingChange={() => {}}
    />,
  )
  const handle = () => {
    if (!assist.current) throw new Error('assist handle not mounted')
    return assist.current
  }
  return handle
}

const title = () => screen.getByLabelText(/^Title/) as HTMLInputElement
const problem = () => screen.getByLabelText(/^Problem/) as HTMLTextAreaElement
const suggestedMarks = () => document.querySelectorAll('[data-suggested-text]').length

describe('IdeaForm assistant handle: read', () => {
  it('sends nothing and locks nothing from an untouched form, so defaults are not "answered"', () => {
    const handle = mount()

    expect(handle().read()).toEqual({ draft: {}, lockedFields: [] })
  })

  it('locks and sends a field the person typed in', () => {
    const handle = mount()

    fireEvent.change(title(), { target: { value: 'My title' } })

    expect(handle().read()).toEqual({
      draft: { title: 'My title' },
      lockedFields: ['title'],
    })
  })

  it('sends a suggested value without locking it', () => {
    const handle = mount()

    act(() => {
      handle().apply({ problem: 'Parts are hard to find' })
    })

    expect(handle().read()).toEqual({
      draft: { problem: 'Parts are hard to find' },
      lockedFields: [],
    })
  })

  it('locks a field once the person edits a suggested value, every turn after', () => {
    const handle = mount()
    act(() => {
      handle().apply({ problem: 'Suggested problem' })
    })

    fireEvent.change(problem(), { target: { value: 'Edited problem' } })

    expect(handle().read().lockedFields).toEqual(['problem'])
    expect(handle().read().lockedFields).toEqual(['problem'])
  })
})

describe('IdeaForm assistant handle: apply and the Suggested mark', () => {
  it('writes the change, reports its label and marks the field Suggested', () => {
    const handle = mount()

    let result: ReturnType<IdeaFormAssist['apply']> | undefined
    act(() => {
      result = handle().apply({ title: 'Faster onboarding', problem: 'Slow' })
    })

    expect(result).toEqual({ filled: ['Title', 'Problem'], kept: [] })
    expect(title().value).toBe('Faster onboarding')
    expect(suggestedMarks()).toBe(2)
  })

  it('clears the mark when the person edits that field, and only that one', () => {
    const handle = mount()
    act(() => {
      handle().apply({ title: 'Suggested title', problem: 'Suggested problem' })
    })

    fireEvent.change(title(), { target: { value: 'Mine' } })

    expect(suggestedMarks()).toBe(1)
    expect(problem().closest('[data-suggested]')).not.toBeNull()
    expect(title().closest('[data-suggested]')).toBeNull()
  })

  it('keeps and reports a field the person owns instead of overwriting it', () => {
    const handle = mount()
    fireEvent.change(title(), { target: { value: 'Mine' } })

    let result: ReturnType<IdeaFormAssist['apply']> | undefined
    act(() => {
      result = handle().apply({ title: 'Assistant title', problem: 'New problem' })
    })

    expect(result).toEqual({ filled: ['Problem'], kept: ['Title'] })
    expect(title().value).toBe('Mine')
  })

  it('hands an owned field back to the assistant when a suggestion is chosen (release)', () => {
    const handle = mount()
    fireEvent.change(problem(), { target: { value: 'Mine' } })

    act(() => {
      handle().apply({ problem: 'Chosen suggestion' }, { release: true })
    })

    expect(problem().value).toBe('Chosen suggestion')
    expect(handle().read().lockedFields).not.toContain('problem')
    expect(suggestedMarks()).toBe(1)
  })

  it('ignores an id the form does not offer and an unchanged value', () => {
    const handle = mount()

    let result: ReturnType<IdeaFormAssist['apply']> | undefined
    act(() => {
      result = handle().apply({ businessImpactId: 'impact-from-elsewhere', priority: 'Nonsense' })
    })

    expect(result).toEqual({ filled: [], kept: [] })
    expect(suggestedMarks()).toBe(0)
  })
})

describe('IdeaForm assistant handle: place (failed turn, no model call)', () => {
  it('puts the text into the field the assistant had asked about, when it is empty', () => {
    const handle = mount()

    act(() => {
      handle().place('Parts are hard to find. It costs hours.', 'problem')
    })

    expect(problem().value).toBe('Parts are hard to find. It costs hours.')
  })

  it('takes the first clause as the title when the title is empty', () => {
    const handle = mount()

    act(() => {
      handle().place('Parts are hard to find. It costs hours.', 'problem')
    })

    expect(title().value).toBe('Parts are hard to find')
  })

  it('does not overwrite a title the person already has', () => {
    const handle = mount()
    fireEvent.change(title(), { target: { value: 'Mine' } })

    act(() => {
      handle().place('Something else entirely', 'problem')
    })

    expect(title().value).toBe('Mine')
  })

  it('appends to Problem on a new line when the asked field is not a text field or is taken', () => {
    const handle = mount()
    fireEvent.change(problem(), { target: { value: 'First thought' } })

    act(() => {
      handle().place('Second thought', 'problem')
    })
    expect(problem().value).toBe('First thought\nSecond thought')

    act(() => {
      handle().place('Third thought', 'businessImpactId')
    })
    expect(problem().value).toBe('First thought\nSecond thought\nThird thought')
  })

  it('falls back to Problem when no step is known', () => {
    const handle = mount()

    act(() => {
      handle().place('Just some text', undefined)
    })

    expect(problem().value).toBe('Just some text')
  })

  it('treats the placed text as the person’s own: owned, never marked Suggested', () => {
    const handle = mount()
    act(() => {
      handle().apply({ problem: 'Suggested' })
    })
    expect(suggestedMarks()).toBe(1)

    act(() => {
      handle().place('Mine now', 'problem')
    })

    expect(suggestedMarks()).toBe(0)
    expect(handle().read().lockedFields).toContain('problem')
  })

  it('ignores blank text', () => {
    const handle = mount()

    act(() => {
      handle().place('   ', 'problem')
    })

    expect(problem().value).toBe('')
    expect(handle().read().lockedFields).toEqual([])
  })
})
