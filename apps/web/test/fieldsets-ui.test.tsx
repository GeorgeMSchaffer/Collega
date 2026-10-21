import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FieldsetEditForm } from '@/components/settings/fieldset-edit-form'
import { IdeaTypeFieldsPicker } from '@/components/settings/idea-type-fields-picker'
import type { FieldDefinition, Fieldset, IdeaType } from '@/lib/types'

/**
 * The fieldsets screens (`SPEC/contracts/fieldsets.md`): the idea-type picker's two panes and the
 * fieldset editor. What matters is what the form would post, so these read the form's data back.
 * The server actions are the boundary and are replaced.
 */
vi.mock('@/lib/server/catalog-actions', () => ({
  saveIdeaTypeFields: vi.fn(),
  updateFieldset: vi.fn(),
  deleteFieldset: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const field = (id: string, name: string, required = false): FieldDefinition => ({
  id,
  name,
  fieldType: 'Text',
  required,
  usedBy: [],
})
const FIELDS = [field('f-a', 'Cost'), field('f-b', 'Date'), field('f-c', 'Owner', true)]

const SET_DELIVERY: Fieldset = {
  id: 's-1',
  name: 'Delivery',
  description: null,
  usedByIdeaTypeCount: 0,
  fields: [
    { id: 'f-a', name: 'Cost', fieldType: 'Text', isActive: true },
    { id: 'f-old', name: 'Legacy', fieldType: 'Text', isActive: false },
  ],
}
const SET_PEOPLE: Fieldset = { ...SET_DELIVERY, id: 's-2', name: 'People', fields: [] }

const ideaType = (overrides: Partial<IdeaType> = {}): IdeaType => ({
  id: 'type-1',
  name: 'Spike',
  curatedFieldCount: null,
  fields: [],
  fieldsets: [],
  ...overrides,
})

function posted(container: HTMLElement, name: string): string[] {
  const form = container.querySelector('form') as HTMLFormElement
  return new FormData(form).getAll(name).map(String)
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('the idea type field picker', () => {
  function renderPicker(type = ideaType(), fieldsets = [SET_DELIVERY, SET_PEOPLE]) {
    return render(<IdeaTypeFieldsPicker ideaType={type} fields={FIELDS} fieldsets={fieldsets} />)
  }

  it('says an empty selection means every active field, and posts nothing', () => {
    const { container } = renderPicker()

    expect(screen.getByText('All active fields')).toBeTruthy()
    expect(posted(container, 'fieldDefinitionId')).toEqual([])
    expect(posted(container, 'fieldsetId')).toEqual([])
    expect(posted(container, 'ideaTypeId')).toEqual(['type-1'])
  })

  it('adds a field with its own Required default, and lets the type override it', () => {
    const { container } = renderPicker()
    click('Add field Owner')

    expect(posted(container, 'fieldDefinitionId')).toEqual(['f-c'])
    expect(posted(container, 'fieldRequired')).toEqual(['1'])

    fireEvent.click(screen.getByLabelText('Owner is required on this type'))
    expect(posted(container, 'fieldRequired')).toEqual(['0'])
  })

  it('posts fields and fieldsets in the order they are arranged', () => {
    const { container } = renderPicker()
    click('Add field Cost')
    click('Add field Date')
    click('Move Date up')
    click('Add fieldset Delivery')
    click('Add fieldset People')
    click('Move fieldset People up')

    expect(posted(container, 'fieldDefinitionId')).toEqual(['f-b', 'f-a'])
    expect(posted(container, 'fieldsetId')).toEqual(['s-2', 's-1'])
  })

  it('keeps each field’s Required flag with it when the order changes', () => {
    const { container } = renderPicker()
    click('Add field Cost')
    click('Add field Owner')
    click('Move Owner up')

    expect(posted(container, 'fieldDefinitionId')).toEqual(['f-c', 'f-a'])
    expect(posted(container, 'fieldRequired')).toEqual(['1', '0'])
  })

  it('starts from the type’s saved selection', () => {
    const { container } = renderPicker(
      ideaType({
        fields: [{ fieldDefinitionId: 'f-b', isRequired: true }],
        fieldsets: [{ id: 's-1', name: 'Delivery' }],
      }),
    )

    expect(posted(container, 'fieldDefinitionId')).toEqual(['f-b'])
    expect(posted(container, 'fieldRequired')).toEqual(['1'])
    expect(posted(container, 'fieldsetId')).toEqual(['s-1'])
    expect(screen.queryByRole('button', { name: 'Add field Date' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add fieldset Delivery' })).toBeNull()
  })

  it('removes a field or fieldset, and Clear all returns to the empty state', () => {
    const { container } = renderPicker()
    click('Add field Cost')
    click('Add fieldset People')
    click('Remove field Cost')
    expect(posted(container, 'fieldDefinitionId')).toEqual([])
    expect(posted(container, 'fieldsetId')).toEqual(['s-2'])

    click('Clear all')
    expect(posted(container, 'fieldsetId')).toEqual([])
    expect(screen.getByText('All active fields')).toBeTruthy()
  })

  it('shows an attached fieldset’s members read-only, marking an archived one', () => {
    renderPicker()
    click('Add fieldset Delivery')

    const selected = within(screen.getByRole('region', { name: 'On this type' }))
    expect(selected.getByText('Cost')).toBeTruthy()
    expect(selected.getByText('Legacy (archived)')).toBeTruthy()
  })

  it('says which attached fieldset already holds a field offered on the left', () => {
    renderPicker()
    click('Add fieldset Delivery')

    expect(screen.getByText('Text · already in Delivery')).toBeTruthy()
  })

  it('filters both lists by the search text', () => {
    renderPicker()
    fireEvent.change(screen.getByLabelText('Search fields and fieldsets'), {
      target: { value: 'peo' },
    })

    expect(screen.getByRole('button', { name: 'Add fieldset People' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add fieldset Delivery' })).toBeNull()
    expect(screen.getByText('No field matches.')).toBeTruthy()
  })

  it('says when the organization has no fieldsets', () => {
    renderPicker(ideaType(), [])
    expect(screen.getByText('The organization has no fieldsets yet.')).toBeTruthy()
  })
})

describe('the fieldset editor', () => {
  function renderEditor(fieldset = SET_DELIVERY) {
    return render(<FieldsetEditForm fieldset={fieldset} fields={FIELDS} />)
  }
  const saveForm = (container: HTMLElement) =>
    container.querySelectorAll('form')[0] as HTMLFormElement
  const members = (container: HTMLElement) =>
    new FormData(saveForm(container)).getAll('fieldDefinitionId').map(String)

  it('leaves an archived member out of what it posts, and says saving drops it', () => {
    const { container } = renderEditor()

    expect(members(container)).toEqual(['f-a'])
    expect(screen.getByText('Archived')).toBeTruthy()
    expect(screen.getByText(/dropped from the set when you save/)).toBeTruthy()
  })

  it('posts members in the arranged order, including ones added here', () => {
    const { container } = renderEditor()
    click('Add Date')
    // Up past the archived member (shown, not posted), then past Cost.
    click('Move Date up')
    click('Move Date up')

    expect(members(container)).toEqual(['f-b', 'f-a'])
  })

  it('offers only fields not already in the set', () => {
    renderEditor()

    expect(screen.queryByRole('button', { name: 'Add Cost' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add Date' })).toBeTruthy()
  })

  it('can empty the set', () => {
    const { container } = renderEditor()
    click('Remove Cost')
    click('Remove Legacy')

    expect(members(container)).toEqual([])
    expect(screen.getByText(/No fields yet/)).toBeTruthy()
  })

  it('warns that saving changes every idea type that uses the set', () => {
    renderEditor({ ...SET_DELIVERY, usedByIdeaTypeCount: 2 })
    expect(screen.getByText('Used by 2 idea types')).toBeTruthy()

    expect(screen.queryByText('No idea type uses this set yet.')).toBeNull()
  })

  it('says no idea type uses an unattached set', () => {
    renderEditor()
    expect(screen.getByText('No idea type uses this set yet.')).toBeTruthy()
  })

  it('posts the delete from its own form, apart from the save', () => {
    const { container } = renderEditor()
    const forms = container.querySelectorAll('form')

    expect(forms).toHaveLength(2)
    expect(
      within(forms[1] as HTMLElement).getByRole('button', { name: 'Delete fieldset' }),
    ).toBeTruthy()
    expect(new FormData(forms[1] as HTMLFormElement).getAll('fieldDefinitionId')).toEqual([])
  })
})
