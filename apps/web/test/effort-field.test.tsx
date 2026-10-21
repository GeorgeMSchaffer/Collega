import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EffortField } from '@/components/ideas/effort-field'

/** The idea form's Effort (slice 297, comp U screen 5): three radios, a Clear, a keyed error. */
function setup(props: Partial<Parameters<typeof EffortField>[0]> = {}) {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(
    <EffortField
      value=""
      onChange={onChange}
      onClear={onClear}
      hint="Needed before Implementation."
      {...props}
    />,
  )
  return { onChange, onClear }
}

describe('EffortField', () => {
  it('offers Low, Medium and High as radios in one group, none checked when unset', () => {
    setup()

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((radio) => radio.value)).toEqual(['Low', 'Medium', 'High'])
    expect(radios.every((radio) => !radio.checked)).toBe(true)
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1)
  })

  it('checks the current value', () => {
    setup({ value: 'Medium' })

    expect((screen.getByRole('radio', { name: /Medium/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('reports the chosen level', () => {
    const { onChange } = setup()

    fireEvent.click(screen.getByRole('radio', { name: /High/ }))

    expect(onChange).toHaveBeenCalledWith('High')
  })

  it('offers Clear only once a level is set, and reports it', () => {
    const { onClear } = setup({ value: 'Low' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('has no Clear while unset', () => {
    setup()

    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('shows the hint when there is no error', () => {
    setup()

    expect(screen.getByText('Needed before Implementation.')).toBeTruthy()
  })

  it('replaces the hint with the error and marks the radios invalid, keyed effort on the first', () => {
    setup({ error: 'Effort is required.' })

    expect(screen.getByText('Effort is required.')).toBeTruthy()
    expect(screen.queryByText('Needed before Implementation.')).toBeNull()
    const radios = screen.getAllByRole('radio')
    expect(radios.every((radio) => radio.getAttribute('aria-invalid') === 'true')).toBe(true)
    expect(radios[0]?.getAttribute('data-error-key')).toBe('effort')
    expect(radios[1]?.getAttribute('data-error-key')).toBeNull()
  })
})
