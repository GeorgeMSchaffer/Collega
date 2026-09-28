import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ColorPicker } from '../src/components/color-picker.js'
import { TAG_PALETTE } from '../src/lib/tag-colors.js'

// `20-feature-ideas-and-engagement.md` Tags rule 12.

function Harness({ initial, onChange }: { initial: string; onChange?: (c: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ColorPicker
        id="c"
        name="color"
        value={value}
        onChange={(next) => {
          onChange?.(next)
          setValue(next)
        }}
      />
      <button type="button" onClick={() => setValue('#3FB86B')}>
        reset to palette
      </button>
      <button type="button" onClick={() => setValue('#123456')}>
        reset to custom
      </button>
    </>
  )
}

const swatch = (hex: string) => screen.getByRole('radio', { name: new RegExp(`\\(${hex}\\)`) })
const custom = () => screen.getByRole('textbox', { name: 'Custom' }) as HTMLInputElement
const checked = () => screen.queryAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)

describe('ColorPicker', () => {
  it('offers the ten palette colours as one group of radios, each named by its hex', () => {
    render(<Harness initial="#E5484D" />)
    const group = screen.getByRole('group', { name: 'Colour' })
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(10)
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual([...TAG_PALETTE])
    for (const [n, hex] of TAG_PALETTE.entries()) {
      expect(swatch(hex).getAttribute('aria-label')).toBe(`Colour ${n + 1} (${hex})`)
      expect(group.contains(swatch(hex))).toBe(true)
    }
    expect(new Set(radios.map((r) => (r as HTMLInputElement).name)).size).toBe(1)
  })

  it('shows a palette value as its chosen swatch and in the Custom box', () => {
    render(<Harness initial="#e5484d" />)
    expect(checked()).toEqual([swatch('#E5484D')])
    expect(custom().value).toBe('#E5484D')
  })

  it('shows a custom value with no swatch chosen', () => {
    render(<Harness initial="#123456" />)
    expect(checked()).toEqual([])
    expect(custom().value).toBe('#123456')
  })

  it('choosing a swatch sets the colour', () => {
    const onChange = vi.fn()
    render(<Harness initial="#123456" onChange={onChange} />)
    fireEvent.click(swatch('#6B9BF2'))
    expect(onChange).toHaveBeenLastCalledWith('#6B9BF2')
    expect(checked()).toEqual([swatch('#6B9BF2')])
    expect(custom().value).toBe('#6B9BF2')
  })

  it('typing a custom colour clears the swatch selection, even one that equals a palette colour', () => {
    render(<Harness initial="#E5484D" />)
    fireEvent.change(custom(), { target: { value: '#F5A524' } })
    expect(checked()).toEqual([])
  })

  it('sends only complete colours, upper-cased, and keeps a half-typed one in the box', () => {
    const onChange = vi.fn()
    render(<Harness initial="#E5484D" onChange={onChange} />)
    fireEvent.change(custom(), { target: { value: '#ab' } })
    fireEvent.change(custom(), { target: { value: '#abcd' } })
    fireEvent.change(custom(), { target: { value: 'abcdef1' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(custom().getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(custom(), { target: { value: '#abcdef' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('#ABCDEF')
    expect(custom().hasAttribute('aria-invalid')).toBe(false)
  })

  it('sends the native picker’s lower-case value upper-cased, as a custom colour', () => {
    const onChange = vi.fn()
    const { container } = render(<Harness initial="#E5484D" onChange={onChange} />)
    const native = container.querySelector('input[type="color"]') as HTMLInputElement
    fireEvent.input(native, { target: { value: '#94a3b8' } })
    expect(onChange).toHaveBeenLastCalledWith('#94A3B8')
    expect(checked()).toEqual([])
  })

  it('posts the value upper-cased under its name', () => {
    const { container } = render(<Harness initial="#abcdef" />)
    const hidden = container.querySelector('input[type="hidden"][name="color"]') as HTMLInputElement
    expect(hidden.value).toBe('#ABCDEF')
  })

  it('follows a value its caller sets, choosing the swatch for a palette colour', () => {
    render(<Harness initial="#123456" />)
    fireEvent.click(screen.getByRole('button', { name: 'reset to palette' }))
    expect(checked()).toEqual([swatch('#3FB86B')])
    expect(custom().value).toBe('#3FB86B')

    fireEvent.click(screen.getByRole('button', { name: 'reset to custom' }))
    expect(checked()).toEqual([])
    expect(custom().value).toBe('#123456')
  })

  it('ties a caller’s colour error to the group and the Custom box', () => {
    render(
      <>
        <ColorPicker id="c" value="#E5484D" onChange={() => {}} invalid errorId="c-error" />
        <span id="c-error">Colour must be #RRGGBB.</span>
      </>,
    )
    const group = screen.getByRole('group', { name: 'Colour' })
    expect(group.getAttribute('aria-describedby')).toBe('c-error')
    expect(group.getAttribute('aria-invalid')).toBe('true')
    expect(custom().getAttribute('aria-describedby')?.split(' ')).toContain('c-error')
    expect(custom().getAttribute('aria-invalid')).toBe('true')
  })

  it('carries no error description without one', () => {
    render(<ColorPicker id="c" value="#E5484D" onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Colour' })
    expect(group.hasAttribute('aria-describedby')).toBe(false)
    expect(group.hasAttribute('aria-invalid')).toBe(false)
    expect(custom().getAttribute('aria-describedby')).toBe('c-custom-hint')
    expect(custom().hasAttribute('aria-invalid')).toBe(false)
  })
})
