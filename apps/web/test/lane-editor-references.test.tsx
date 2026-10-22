import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BoardFields } from '@/components/settings/board-form'
import { SwimlanePicker } from '@/components/settings/swimlane-picker'
import type { LaneFlags, ReferenceContext, Status } from '@/lib/types'

/**
 * The lane editor on the board form (slice 288; comp U screen 1, comp T screen 5;
 * `20-feature-board-references.md`; decisions 2026-10-16 and 2026-10-19): Kind, the References
 * selector and its refusals, Remove on a reference lane holding ideas, the auto-create switch.
 * Rendered through `BoardFields`, which owns the flag state, so what a click does is what the form
 * would post: the hidden `laneFlags` field is read back.
 */

const STATUSES: Status[] = [
  { id: 's-new', name: 'New', color: '#111111' },
  { id: 's-review', name: 'Review', color: '#222222' },
  { id: 's-done', name: 'Done', color: '#333333' },
]
const NONE: LaneFlags = { isFinal: false, referencesBoardId: null, autoCreateTask: false }

const CONTEXT: ReferenceContext = {
  choices: [
    {
      id: 'b-impl',
      name: 'Implementation',
      keyPrefix: 'IMPL',
      firstLaneName: 'Todo',
      hasReferenceLane: false,
    },
    {
      id: 'b-chain',
      name: 'Chained',
      keyPrefix: 'CH',
      firstLaneName: null,
      hasReferenceLane: true,
    },
    {
      id: 'b-nokey',
      name: 'No Key',
      keyPrefix: null,
      firstLaneName: null,
      hasReferenceLane: false,
    },
  ],
  referencedBy: [],
}

type Props = Partial<Parameters<typeof BoardFields>[0]>

function renderFields(over: Props = {}) {
  return render(
    <BoardFields
      boardId="b-own"
      defaultName="Discovery"
      swimlaneIds={['s-new', 's-review', 's-done']}
      references={CONTEXT}
      statuses={STATUSES}
      {...over}
    />,
  )
}

const posted = (container: HTMLElement) =>
  JSON.parse(
    (container.querySelector('input[name="laneFlags"]') as HTMLInputElement).value,
  ) as Record<string, LaneFlags>

const kind = (lane: string) => within(screen.getByRole('group', { name: `Kind of ${lane}` }))
const select = (lane: string) =>
  screen.getByRole('combobox', { name: `References board for ${lane}` }) as HTMLSelectElement
const optionOf = (lane: string, text: RegExp) =>
  within(select(lane)).getByRole('option', { name: text }) as HTMLOptionElement

describe('lane Kind', () => {
  it('offers Normal and Final, with Normal chosen by default', () => {
    renderFields()
    expect((kind('New').getByRole('radio', { name: 'Normal' }) as HTMLInputElement).checked).toBe(
      true,
    )
    expect((kind('New').getByRole('radio', { name: 'Final' }) as HTMLInputElement).checked).toBe(
      false,
    )
  })

  it('posts isFinal true after choosing Final, and back to false after Normal', () => {
    const { container } = renderFields()
    fireEvent.click(kind('Done').getByRole('radio', { name: 'Final' }))
    expect(posted(container)['s-done']?.isFinal).toBe(true)
    fireEvent.click(kind('Done').getByRole('radio', { name: 'Normal' }))
    expect(posted(container)['s-done']?.isFinal).toBe(false)
  })

  it('shows a lane loaded as Final with Final chosen', () => {
    renderFields({ laneFlags: { 's-done': { ...NONE, isFinal: true } } })
    expect((kind('Done').getByRole('radio', { name: 'Final' }) as HTMLInputElement).checked).toBe(
      true,
    )
  })

  it('disables Final on a lane that has a reference, with the reason attached', () => {
    renderFields({ laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } } })
    const final = kind('Review').getByRole('radio', { name: 'Final' }) as HTMLInputElement
    expect(final.disabled).toBe(true)
    expect(final.getAttribute('aria-describedby')).toBe('swimlane-final-s-review')
    expect(document.getElementById('swimlane-final-s-review')?.textContent).toBe(
      'Remove the board reference first: a Final lane can’t reference a board.',
    )
    expect(
      (kind('Review').getByRole('radio', { name: 'Normal' }) as HTMLInputElement).disabled,
    ).toBe(false)
  })

  it('leaves Final enabled, with no reason, on a lane without a reference', () => {
    renderFields()
    expect((kind('New').getByRole('radio', { name: 'Final' }) as HTMLInputElement).disabled).toBe(
      false,
    )
    expect(document.getElementById('swimlane-final-s-new')).toBeNull()
  })

  it('re-enables Final once the reference is removed', () => {
    renderFields({ laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } } })
    fireEvent.change(select('Review'), { target: { value: '' } })
    expect(
      (kind('Review').getByRole('radio', { name: 'Final' }) as HTMLInputElement).disabled,
    ).toBe(false)
  })
})

describe('the References selector', () => {
  it('offers None first and posts the chosen board, showing its key prefix as a RefPill', () => {
    const { container } = renderFields()
    expect(select('New').options[0]?.textContent).toBe('None')
    fireEvent.change(select('New'), { target: { value: 'b-impl' } })
    expect(posted(container)['s-new']?.referencesBoardId).toBe('b-impl')
    expect(screen.getByText('IMPL').textContent).toBe('↳IMPL')
  })

  it('shows "board reference" in the pill when the target has no key prefix', () => {
    renderFields({ laneFlags: { 's-new': { ...NONE, referencesBoardId: 'b-nokey' } } })
    expect(screen.getByText('board reference')).toBeTruthy()
  })

  it('shows no pill on a lane without a reference', () => {
    renderFields()
    expect(screen.queryByText('board reference')).toBeNull()
    expect(screen.queryByText('IMPL')).toBeNull()
  })

  it('disables the selector on a Final lane with the Final sentence', () => {
    renderFields({ laneFlags: { 's-done': { ...NONE, isFinal: true } } })
    expect(select('Done').disabled).toBe(true)
    expect(select('Done').getAttribute('aria-describedby')).toBe('swimlane-select-why-s-done')
    expect(document.getElementById('swimlane-select-why-s-done')?.textContent).toBe(
      'A Final lane can’t reference a board.',
    )
    expect(select('New').disabled).toBe(false)
  })

  it('disables the selector with the Final sentence as soon as the lane is made Final', () => {
    renderFields()
    fireEvent.click(kind('New').getByRole('radio', { name: 'Final' }))
    expect(select('New').disabled).toBe(true)
  })

  it('disables the selector with comp T’s sentence, plural, while ideas sit in a lane without a reference', () => {
    renderFields({ laneIdeaCounts: { 's-new': 3 } })
    expect(select('New').disabled).toBe(true)
    expect(document.getElementById('swimlane-select-why-s-new')?.textContent).toBe(
      '3 ideas currently sit in New, so a reference can’t be added while they do.',
    )
    expect(select('Review').disabled).toBe(false)
  })

  it('uses the singular for one idea', () => {
    renderFields({ laneIdeaCounts: { 's-new': 1 } })
    expect(document.getElementById('swimlane-select-why-s-new')?.textContent).toBe(
      '1 idea currently sits in New, so a reference can’t be added while it does.',
    )
  })

  it('says the reference can’t be changed, not added, on a lane that already references a board', () => {
    renderFields({
      laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } },
      laneIdeaCounts: { 's-review': 2 },
    })
    expect(select('Review').disabled).toBe(true)
    expect(document.getElementById('swimlane-select-why-s-review')?.textContent).toBe(
      '2 ideas currently sit in Review, so this reference can’t be changed to another board while they do.',
    )
  })

  it('gives the ideas sentence precedence over the Final one', () => {
    renderFields({
      laneFlags: { 's-done': { ...NONE, isFinal: true } },
      laneIdeaCounts: { 's-done': 1 },
    })
    expect(document.getElementById('swimlane-select-why-s-done')?.textContent).toContain(
      'idea currently sits in Done',
    )
  })

  it('offers an archived board nowhere: only the choices it is given appear', () => {
    renderFields()
    const names = [...select('New').options].map((option) => option.textContent)
    expect(names.some((name) => name?.startsWith('Implementation'))).toBe(true)
    expect(names).toHaveLength(1 + 1 + CONTEXT.choices.length) // None, this board, the choices
    expect(names.join('|')).not.toMatch(/archived/i)
  })

  it('offers the board itself disabled, with the reason, when editing', () => {
    renderFields()
    const own = optionOf('New', /Discovery \(this board\)/)
    expect(own.disabled).toBe(true)
    expect(own.value).toBe('b-own')
    expect(own.textContent).toContain('a lane can’t reference its own board.')
  })

  it('does not offer the board itself on create, where it has no id yet', () => {
    renderFields({ boardId: null })
    expect(within(select('New')).queryByRole('option', { name: /this board/ })).toBeNull()
  })

  it('disables a board that already has a reference lane, with the reason, and enables the rest', () => {
    renderFields()
    const chained = optionOf('New', /Chained/)
    expect(chained.disabled).toBe(true)
    expect(chained.textContent).toContain(
      'it has a reference lane of its own, and only one level of references is allowed.',
    )
    expect(optionOf('New', /^Implementation$/).disabled).toBe(false)
    expect(optionOf('New', /^No Key$/).disabled).toBe(false)
  })

  it('names a reference to a board no longer on the list, rather than showing None', () => {
    renderFields({ laneFlags: { 's-new': { ...NONE, referencesBoardId: 'b-gone' } } })
    expect(select('New').value).toBe('b-gone')
    expect(optionOf('New', /no longer available/)).toBeTruthy()
    expect(screen.getByText('board reference')).toBeTruthy()
  })

  describe('on a board that is the target of a reference', () => {
    const targeted: ReferenceContext = {
      ...CONTEXT,
      referencedBy: [
        { id: 'b-a', name: 'Alpha' },
        { id: 'b-b', name: 'Beta' },
      ],
    }

    it('disables every selector', () => {
      renderFields({ references: targeted })
      for (const lane of ['New', 'Review', 'Done']) expect(select(lane).disabled).toBe(true)
    })

    it('shows the one note naming the referencing boards, once, not per lane', () => {
      renderFields({ references: targeted })
      const notes = screen.getAllByText(/is the target of a reference lane/)
      expect(notes).toHaveLength(1)
      expect(notes[0]?.textContent).toBe(
        'Discovery is the target of a reference lane on Alpha, Beta, so none of its lanes can reference another board.',
      )
    })

    it('shows no note and keeps the selectors live when nothing references the board', () => {
      renderFields()
      expect(screen.queryByText(/is the target of a reference lane/)).toBeNull()
      expect(select('New').disabled).toBe(false)
    })
  })

  it('leaves the References controls out when the page supplied no reference context', () => {
    renderFields({ references: undefined })
    // No choices: the selector still lists None and this board only.
    expect([...select('New').options].map((option) => option.value)).toEqual(['', 'b-own'])
  })
})

describe('Remove on a reference lane', () => {
  const referencing = { 's-review': { ...NONE, referencesBoardId: 'b-impl' } }
  const remove = (lane: string) =>
    screen.getByRole('button', { name: `Remove ${lane} from this board` })

  it('is refused with its reason while ideas sit in a reference lane', () => {
    renderFields({ laneFlags: referencing, laneIdeaCounts: { 's-review': 2 } })
    const button = remove('Review')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-describedby')).toBe('swimlane-remove-s-review')
    expect(document.getElementById('swimlane-remove-s-review')?.textContent).toBe(
      '2 ideas sit in this lane',
    )
    // Focusable, not natively disabled, so the reason stays reachable.
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('uses the singular for one idea', () => {
    renderFields({ laneFlags: referencing, laneIdeaCounts: { 's-review': 1 } })
    expect(document.getElementById('swimlane-remove-s-review')?.textContent).toBe(
      '1 idea sits in this lane',
    )
  })

  it('does nothing when clicked', () => {
    const { container } = renderFields({
      laneFlags: referencing,
      laneIdeaCounts: { 's-review': 2 },
    })
    fireEvent.click(remove('Review'))
    expect(screen.getByRole('combobox', { name: 'References board for Review' })).toBeTruthy()
    expect(container.querySelectorAll('input[name="swimlaneIds"]')).toHaveLength(3)
  })

  it('removes a reference lane that holds no ideas', () => {
    const { container } = renderFields({ laneFlags: referencing })
    expect(remove('Review').getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(remove('Review'))
    expect(
      [...container.querySelectorAll<HTMLInputElement>('input[name="swimlaneIds"]')].map(
        (i) => i.value,
      ),
    ).toEqual(['s-new', 's-done'])
  })

  it('does not block, on this rule, a lane with ideas that has no reference', () => {
    renderFields({ laneIdeaCounts: { 's-new': 4 } })
    expect(document.getElementById('swimlane-remove-s-new')).toBeNull()
    expect(remove('New').getAttribute('aria-disabled')).toBeNull()
  })
})

describe('the auto-create switch', () => {
  const autoSwitch = (lane: string) => {
    const li = screen.getByRole('combobox', { name: `References board for ${lane}` }).closest('li')
    return li ? within(li).queryByRole('switch', { name: 'Auto-create one task on entry' }) : null
  }

  it('is shown only on a lane that references a board', () => {
    renderFields({ laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } } })
    expect(autoSwitch('New')).toBeNull()
    expect(autoSwitch('Done')).toBeNull()
    expect(autoSwitch('Review')).toBeTruthy()
  })

  it('appears when a reference is chosen', () => {
    renderFields()
    expect(autoSwitch('New')).toBeNull()
    fireEvent.change(select('New'), { target: { value: 'b-impl' } })
    expect(autoSwitch('New')).toBeTruthy()
  })

  it('shows the helper copy naming the target and its first lane, and the first-entry limit', () => {
    renderFields({ laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } } })
    const helper = document.getElementById('swimlane-auto-s-review') as HTMLElement
    expect(helper.textContent).toBe(
      'A card entering this lane gets one task named after it, in the first lane of Implementation (Todo). The card then waits on it.Cards already in this lane are not changed.',
    )
    expect(autoSwitch('Review')?.getAttribute('aria-describedby')).toBe('swimlane-auto-s-review')
  })

  it('omits the first-lane parenthesis when the target has none', () => {
    renderFields({ laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-nokey' } } })
    expect(document.getElementById('swimlane-auto-s-review')?.textContent).toContain(
      'in the first lane of No Key. The card',
    )
  })

  it('toggles autoCreateTask in what the form posts', () => {
    const { container } = renderFields({
      laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } },
    })
    expect(autoSwitch('Review')?.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(autoSwitch('Review') as HTMLElement)
    expect(autoSwitch('Review')?.getAttribute('aria-checked')).toBe('true')
    expect(posted(container)['s-review']?.autoCreateTask).toBe(true)
    fireEvent.click(autoSwitch('Review') as HTMLElement)
    expect(posted(container)['s-review']?.autoCreateTask).toBe(false)
  })

  it('turns off, with a note, when the reference is removed while it was on', () => {
    const { container } = renderFields({
      laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl', autoCreateTask: true } },
    })
    fireEvent.change(select('Review'), { target: { value: '' } })
    expect(autoSwitch('Review')).toBeNull()
    expect(posted(container)['s-review']).toMatchObject({
      referencesBoardId: null,
      autoCreateTask: false,
    })
    expect(screen.getByRole('status').textContent).toBe(
      'Auto-create turned off — it needs a referenced board.',
    )
  })

  it('shows no note when the switch was already off', () => {
    renderFields({ laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl' } } })
    fireEvent.change(select('Review'), { target: { value: '' } })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('drops the note once a reference is put back', () => {
    renderFields({
      laneFlags: { 's-review': { ...NONE, referencesBoardId: 'b-impl', autoCreateTask: true } },
    })
    fireEvent.change(select('Review'), { target: { value: '' } })
    fireEvent.change(select('Review'), { target: { value: 'b-impl' } })
    expect(screen.queryByRole('status')).toBeNull()
    expect(autoSwitch('Review')?.getAttribute('aria-checked')).toBe('false')
  })
})

describe('a refused save’s lane message', () => {
  it('shows the lane’s message as an alert on that lane only', () => {
    renderFields({
      refusals: { laneErrors: { 's-review': 'A Final lane can’t reference a board.' } },
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('A Final lane can’t reference a board.')
    expect(alert.closest('li')?.textContent).toContain('Review')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('read-only lanes', () => {
  function readOnly(flags: Record<string, LaneFlags>) {
    return render(
      <SwimlanePicker
        readOnly
        ids={['s-new', 's-review']}
        onChange={() => {}}
        statuses={STATUSES}
        flags={flags}
        references={CONTEXT}
      />,
    )
  }

  it('shows each lane’s Kind as a value and renders no controls', () => {
    readOnly({ 's-review': { ...NONE, isFinal: true } })
    expect(screen.getByText('Final')).toBeTruthy()
    expect(screen.getByText('Normal')).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })

  it('shows the reference as a pill and a sentence, with auto-create stated as a value', () => {
    readOnly({ 's-new': { ...NONE, referencesBoardId: 'b-impl', autoCreateTask: true } })
    expect(screen.getByText('IMPL')).toBeTruthy()
    expect(
      screen.getByText('References Implementation. Auto-creates one task on entry.'),
    ).toBeTruthy()
  })

  it('names a reference to an unlisted board as another board', () => {
    readOnly({ 's-new': { ...NONE, referencesBoardId: 'b-gone' } })
    expect(screen.getByText('References another board.')).toBeTruthy()
    expect(screen.getByText('board reference')).toBeTruthy()
  })

  it('posts nothing: no hidden swimlane inputs', () => {
    const { container } = readOnly({})
    expect(container.querySelector('input')).toBeNull()
  })
})

describe('Idea features', () => {
  const ideaSwitch = () => screen.getByRole('switch', { name: 'Idea features' })
  const hidden = (container: HTMLElement) =>
    (container.querySelector('input[name="ideaFeaturesEnabled"]') as HTMLInputElement).value

  it('is on by default, with the ordinary-board copy', () => {
    const { container } = renderFields()
    expect(ideaSwitch().getAttribute('aria-checked')).toBe('true')
    expect(hidden(container)).toBe('true')
    expect(document.getElementById('idea-features-hint')?.textContent).toContain(
      'On for ordinary boards.',
    )
  })

  it('posts false once turned off', () => {
    const { container } = renderFields()
    fireEvent.click(ideaSwitch())
    expect(hidden(container)).toBe('false')
  })

  it('explains an off switch on a reference target with the “Off, because…” copy', () => {
    renderFields({
      ideaFeaturesEnabled: false,
      references: { ...CONTEXT, referencedBy: [{ id: 'b-a', name: 'Alpha' }] },
    })
    expect(document.getElementById('idea-features-hint')?.textContent).toMatch(
      /^Off, because this board is the target of a reference\./,
    )
  })

  it('does not use that copy on an ordinary board that is off', () => {
    renderFields({ ideaFeaturesEnabled: false })
    expect(document.getElementById('idea-features-hint')?.textContent).not.toMatch(/^Off, because/)
  })

  it('does not use that copy on a reference target that is on', () => {
    renderFields({ references: { ...CONTEXT, referencedBy: [{ id: 'b-a', name: 'Alpha' }] } })
    expect(document.getElementById('idea-features-hint')?.textContent).not.toMatch(/^Off, because/)
  })
})

describe('what the picker posts', () => {
  it('submits one hidden swimlaneIds field per lane, in list order', () => {
    const { container } = renderFields()
    expect(
      [...container.querySelectorAll<HTMLInputElement>('input[name="swimlaneIds"]')].map(
        (i) => i.value,
      ),
    ).toEqual(['s-new', 's-review', 's-done'])
  })

  it('keeps a lane’s flags in the post when it moves', () => {
    const { container } = renderFields({
      laneFlags: { 's-new': { ...NONE, referencesBoardId: 'b-impl' } },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move New later' }))
    expect(posted(container)['s-new']?.referencesBoardId).toBe('b-impl')
  })
})
