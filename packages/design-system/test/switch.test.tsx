import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '../src/components/switch.js'

// Comp U's `.sw`. Space and Enter are the browser's own activation of a native button, which
// jsdom does not synthesise from a key event, so the keyboard contract is asserted as "it is a
// focusable, enabled native button that fires onClick" rather than by pressing keys.

describe('Switch', () => {
  it('is a switch named by its children', () => {
    render(
      <Switch checked={false} onCheckedChange={() => {}}>
        Idea features
      </Switch>,
    )
    expect(screen.getByRole('switch', { name: 'Idea features' })).toBeTruthy()
  })

  it.each([true, false])('reports aria-checked %s from `checked`', (checked) => {
    render(
      <Switch checked={checked} onCheckedChange={() => {}}>
        Label
      </Switch>,
    )
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(String(checked))
  })

  it('calls onCheckedChange with the opposite value on click', () => {
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={onCheckedChange}>
        Label
      </Switch>,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)
    rerender(
      <Switch checked onCheckedChange={onCheckedChange}>
        Label
      </Switch>,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenLastCalledWith(false)
  })

  it('is a native button that never submits a form, so Space and Enter activate it', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Switch checked={false} onCheckedChange={() => {}}>
          Label
        </Switch>
      </form>,
    )
    const control = screen.getByRole('switch')
    expect(control.tagName).toBe('BUTTON')
    expect(control.getAttribute('type')).toBe('button')
    expect(control.hasAttribute('disabled')).toBe(false)
    fireEvent.click(control)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ignores a click while aria-disabled, but stays focusable', () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange} aria-disabled="true">
        Label
      </Switch>,
    )
    const control = screen.getByRole('switch')
    fireEvent.click(control)
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(control.hasAttribute('disabled')).toBe(false)
    control.focus()
    expect(document.activeElement).toBe(control)
  })

  it('ignores a click while aria-disabled is the boolean true', () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange} aria-disabled>
        Label
      </Switch>,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('ignores a click when natively disabled', () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange} disabled>
        Label
      </Switch>,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('runs the caller onClick first, and a preventDefault there stops the toggle', () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        onClick={(event) => event.preventDefault()}
      >
        Label
      </Switch>,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('keeps its aria-describedby pointing at the reason', () => {
    render(
      <>
        <Switch checked={false} onCheckedChange={() => {}} aria-describedby="why">
          Label
        </Switch>
        <span id="why">Because.</span>
      </>,
    )
    expect(screen.getByRole('switch', { description: 'Because.' })).toBeTruthy()
  })
})
