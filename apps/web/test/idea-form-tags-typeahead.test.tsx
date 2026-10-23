import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { IdeaFormOptions } from '@/lib/types'

/**
 * The Tags combobox's suggestions and *Create tag* option (slice 148; Enter behaviour is pinned in
 * `idea-tags-enter.test.tsx`): suggestions come from the catalog by case-insensitive prefix from two
 * characters and leave out chosen tags; a name nothing matches exactly is offered as *Create tag*;
 * a created tag is a dashed chip marked *new*; ↑/↓/Escape/Backspace; the ten-tag cap; and
 * `tagNames` refusals render beside the field. The server action is the boundary.
 */
const saveIdea = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  saveIdea,
}))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [
    { id: 't-safety', name: 'Safety', color: '#c0392b' },
    { id: 't-saving', name: 'savings', color: '#27ae60' },
    { id: 't-ops', name: 'ops', color: '#2980b9' },
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

const input = () => screen.getByLabelText('Tags (optional)') as HTMLInputElement
const type = (text: string) => fireEvent.change(input(), { target: { value: text } })
const key = (name: string) => fireEvent.keyDown(input(), { key: name })
// The form's <select>s own role="option" too, so everything here is scoped to the Tags listbox.
const listbox = () =>
  document.getElementById(input().getAttribute('aria-controls') ?? '') as HTMLElement
const optionNodes = () => within(listbox()).queryAllByRole('option')
const options = () => optionNodes().map((o) => o.textContent)
const chip = (name: string) => screen.queryByRole('button', { name: `Remove ${name}` })

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

describe('suggestions', () => {
  it('match by prefix, case-insensitively, and add Create tag when nothing matches exactly', () => {
    renderForm()
    type('SA')
    expect(options()).toEqual(['Safety', 'savings', 'Create tag ‘SA’'])
  })

  it('do not match inside a name', () => {
    renderForm()
    type('fe')
    expect(options()).toEqual(['Create tag ‘fe’'])
  })

  it('wait for two characters', () => {
    renderForm()
    type('s')
    expect(options()).toEqual([])
    expect(listbox().hasAttribute('hidden')).toBe(true)
  })

  it('leave out a tag already chosen', () => {
    renderForm()
    type('safety')
    key('Enter')
    type('sa')
    expect(options()).toEqual(['savings', 'Create tag ‘sa’'])
  })

  it('offer no Create tag when the text is an existing tag’s exact name, whatever its case', () => {
    renderForm()
    type('OPS')
    expect(options()).toEqual(['ops'])
  })

  it('offer no Create tag for a name already chosen as a new tag', () => {
    renderForm()
    type('brand-new')
    key('Enter')
    type('Brand-New')
    expect(options()).toEqual([])
  })

  it('show in the listbox, expanded, with the combobox roles set', () => {
    renderForm()
    type('sa')
    expect(input().getAttribute('aria-expanded')).toBe('true')
    expect(input().getAttribute('aria-controls')).toBe(listbox().id)
    expect(input().getAttribute('role')).toBe('combobox')
  })
})

describe('choosing an option', () => {
  it('adds an existing tag with the catalog’s spelling when clicked', () => {
    renderForm()
    type('SAV')
    fireEvent.click(within(listbox()).getByRole('option', { name: 'savings' }))
    expect(chip('savings')).not.toBeNull()
    expect(input().value).toBe('')
  })

  it('adds Create tag as a dashed chip marked new', () => {
    renderForm()
    type('brand-new')
    fireEvent.click(within(listbox()).getByRole('option', { name: /Create tag/ }))
    const created = chip('brand-new')?.closest('span') as HTMLElement
    expect(created.className).toContain('border-dashed')
    expect(within(created).getByText('new')).toBeTruthy()
  })

  it('does not mark a catalog tag as new', () => {
    renderForm()
    type('ops')
    key('Enter')
    expect(screen.queryByText('new')).toBeNull()
  })
})

describe('the keyboard', () => {
  it('moves the highlight with ↓ and ↑, wrapping, and names it in aria-activedescendant', () => {
    renderForm()
    type('sa')
    key('ArrowDown')
    const [first, second, third] = optionNodes()
    expect(input().getAttribute('aria-activedescendant')).toBe(first?.id)
    key('ArrowDown')
    expect(input().getAttribute('aria-activedescendant')).toBe(second?.id)
    key('ArrowUp')
    expect(input().getAttribute('aria-activedescendant')).toBe(first?.id)
    key('ArrowUp')
    expect(input().getAttribute('aria-activedescendant')).toBe(third?.id)
  })

  it('closes the list on Escape and leaves the text', () => {
    renderForm()
    type('sa')
    key('Escape')
    expect(input().getAttribute('aria-expanded')).toBe('false')
    expect(input().value).toBe('sa')
  })

  it('removes the last chip on Backspace in an empty box', () => {
    renderForm()
    type('ops')
    key('Enter')
    type('safety')
    key('Enter')
    key('Backspace')
    expect(chip('Safety')).toBeNull()
    expect(chip('ops')).not.toBeNull()
  })

  it('leaves the chips alone on Backspace while there is text', () => {
    renderForm()
    type('ops')
    key('Enter')
    type('x')
    key('Backspace')
    expect(chip('ops')).not.toBeNull()
  })
})

describe('the ten-tag cap', () => {
  function addTen() {
    for (let i = 0; i < 10; i += 1) {
      type(`tag-${i}`)
      key('Enter')
    }
  }

  it('makes the box read-only, offers nothing and says why at ten', () => {
    renderForm()
    addTen()
    expect(screen.getAllByRole('button', { name: /^Remove tag-/ })).toHaveLength(10)
    expect(input().readOnly).toBe(true)
    expect(
      screen.getByText('An idea can have at most 10 tags. Remove one to add another.'),
    ).toBeTruthy()
  })

  it('takes new text again after one is removed', () => {
    renderForm()
    addTen()
    fireEvent.click(chip('tag-3') as HTMLElement)
    expect(input().readOnly).toBe(false)
  })

  it('limits the typed text to 100 characters', () => {
    renderForm()
    expect(input().maxLength).toBe(100)
  })
})

describe('what is saved', () => {
  it('sends catalog and new tags by name, in the order chosen', async () => {
    const form = renderForm()
    fillRequired()
    type('brand-new')
    key('Enter')
    type('sav')
    fireEvent.click(within(listbox()).getByRole('option', { name: 'savings' }))
    fireEvent.submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0].tagNames).toEqual(['brand-new', 'savings'])
  })

  it('shows a tagNames refusal beside the field', async () => {
    saveIdea.mockResolvedValue({
      ok: false,
      error: null,
      errors: { tagNames: 'An idea can have at most 10 tags.' },
    })
    const form = renderForm()
    fillRequired()
    fireEvent.submit(form)
    const message = await screen.findByText('An idea can have at most 10 tags.')
    expect(message.closest('fieldset')?.textContent).toContain('Tags (optional)')
  })
})
