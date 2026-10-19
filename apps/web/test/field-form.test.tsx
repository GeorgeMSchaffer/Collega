import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldForm } from '@/components/settings/field-form'
import { createFieldDefinition } from '@/lib/server/catalog-actions'

/**
 * "Add field" on Settings → Custom fields (slice 144): the type decides whether choice rows show,
 * rows can be added, what is submitted reaches the action as the form carries it, and the API's
 * messages render beside the control they belong to. The action is the boundary.
 */
vi.mock('@/lib/server/catalog-actions', () => ({ createFieldDefinition: vi.fn() }))

const create = vi.mocked(createFieldDefinition)
const BASE = {
  error: null,
  errors: {},
  name: '',
  description: '',
  fieldType: 'Text',
  required: false,
  created: false,
}

beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue({ ...BASE, created: true })
})

const type = () => screen.getByLabelText('Type') as HTMLSelectElement
const choose = (value: string) => fireEvent.change(type(), { target: { value } })

async function submit(name = 'Region') {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  await act(async () => {
    fireEvent.submit(
      screen.getByRole('button', { name: 'Add field' }).closest('form') as HTMLFormElement,
    )
  })
}

describe('the type select', () => {
  it('offers all seven field types, Text first', () => {
    render(<FieldForm />)
    expect(Array.from(type().options).map((o) => o.value)).toEqual([
      'Text',
      'Number',
      'Date',
      'Boolean',
      'Dropdown',
      'MultiSelect',
      'Url',
    ])
  })

  it.each(['Text', 'Number', 'Date', 'Boolean', 'Url'])('shows no choices for %s', (value) => {
    render(<FieldForm />)
    choose(value)
    expect(screen.queryByText('Choices')).toBeNull()
    expect(screen.queryByLabelText('Choice 1')).toBeNull()
  })

  it.each(['Dropdown', 'MultiSelect'])('reveals the choices for %s', (value) => {
    render(<FieldForm />)
    choose(value)
    expect(screen.getByText('Choices')).toBeTruthy()
    expect(screen.getByLabelText('Choice 1')).toBeTruthy()
    expect(screen.getByText(`A ${value} field needs at least one choice.`)).toBeTruthy()
  })
})

describe('the choice rows', () => {
  it('add as many as needed, one per press', () => {
    render(<FieldForm />)
    choose('Dropdown')
    fireEvent.click(screen.getByRole('button', { name: 'Add a choice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a choice' }))
    expect(screen.getAllByLabelText(/^Choice \d+$/)).toHaveLength(3)
  })

  it('keep what was typed when another is added', () => {
    render(<FieldForm />)
    choose('Dropdown')
    fireEvent.change(screen.getByLabelText('Choice 1'), { target: { value: 'North' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add a choice' }))
    expect((screen.getByLabelText('Choice 1') as HTMLInputElement).value).toBe('North')
  })
})

describe('submitting', () => {
  it('hands the action the name, the type and every choice row in order', async () => {
    render(<FieldForm />)
    choose('Dropdown')
    fireEvent.change(screen.getByLabelText('Choice 1'), { target: { value: 'North' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add a choice' }))
    fireEvent.change(screen.getByLabelText('Choice 2'), { target: { value: 'South' } })
    await submit('Region')
    expect(create).toHaveBeenCalledTimes(1)
    const form = create.mock.calls[0]?.[1] as FormData
    expect(form.get('name')).toBe('Region')
    expect(form.get('fieldType')).toBe('Dropdown')
    expect(form.getAll('optionLabel')).toEqual(['North', 'South'])
  })

  it('returns the form to Text with one empty choice row after a successful create', async () => {
    render(<FieldForm />)
    choose('Dropdown')
    fireEvent.click(screen.getByRole('button', { name: 'Add a choice' }))
    await submit()
    expect(type().value).toBe('Text')
    choose('Dropdown')
    expect(screen.getAllByLabelText(/^Choice \d+$/)).toHaveLength(1)
  })
})

describe('refusals', () => {
  it('render the name message beside the Name control', async () => {
    create.mockResolvedValue({
      ...BASE,
      error: 'Invalid.',
      errors: { name: 'A field with that name already exists.' },
    })
    render(<FieldForm />)
    await submit('Dup')
    expect(screen.getByText('A field with that name already exists.')).toBeTruthy()
  })

  it('render the choices message under the choices and keep the choices open', async () => {
    create.mockResolvedValue({
      ...BASE,
      fieldType: 'Dropdown',
      error: 'Invalid.',
      errors: { fieldDefinition: 'A Dropdown field needs at least one option.' },
    })
    render(<FieldForm />)
    choose('Dropdown')
    await submit()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('A Dropdown field needs at least one option.')
    // Not asserted: the select's own value. jsdom resets a controlled <select> to its first option
    // when the form action settles (React's form reset); whether a browser does too is unchecked.
    expect(screen.getByLabelText('Choice 1')).toBeTruthy()
  })

  it('show a refusal with no control of its own above the form', async () => {
    create.mockResolvedValue({ ...BASE, error: 'An App Admin belongs to no organization.' })
    render(<FieldForm />)
    await submit()
    expect(screen.getByRole('alert').textContent).toContain('belongs to no organization')
  })
})
