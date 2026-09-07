import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '../src/components/button.js'
import { Denied } from '../src/components/denied.js'

/**
 * The primitive half of the denied contract. The call sites in `apps/web` assert the whole chain;
 * this asserts the two pieces the design system owns.
 *
 * `Denied` shows the reason and never disables anything itself, and `Button` renders exactly the
 * attributes it is handed. A `Button` that helpfully set `disabled` alongside `aria-disabled` would
 * take every denied control out of the tab order and make its reason unreachable, which is the
 * defect this file exists to catch before it reaches a call site.
 */
describe('Denied', () => {
  it('renders the reason in an element with the id the caller will point at', () => {
    render(
      <Denied reason="Read-only account" id="why-new">
        <Button aria-disabled="true" aria-describedby="why-new">
          New idea
        </Button>
      </Denied>,
    )

    const description = document.getElementById('why-new')
    expect(description).not.toBeNull()
    expect(description?.textContent).toBe('Read-only account')
  })

  it('shows the control rather than hiding it', () => {
    // Hiding a denied action makes the product a different shape per role and leaves the reader no
    // way to learn why. The rule is: visible, marked, and explained.
    render(
      <Denied reason="Act as a member" id="why-new">
        <Button aria-disabled="true" aria-describedby="why-new">
          New idea
        </Button>
      </Denied>,
    )

    expect(screen.getByRole('button', { name: 'New idea' })).toBeTruthy()
    expect(screen.getByText('Act as a member')).toBeTruthy()
  })

  it('leaves the reason readable rather than hiding it from assistive technology', () => {
    render(
      <Denied reason="Act as a member" id="why-new">
        <span>child</span>
      </Denied>,
    )

    const description = document.getElementById('why-new')
    expect(description?.getAttribute('aria-hidden')).toBeNull()
  })

  it('disables nothing on its own', () => {
    render(
      <Denied reason="Act as a member" id="why-new">
        <Button>New idea</Button>
      </Denied>,
    )

    const button = screen.getByRole('button', { name: 'New idea' })
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBeNull()
  })
})

describe('Button', () => {
  it('keeps an aria-disabled button focusable', () => {
    render(<Button aria-disabled="true">Denied</Button>)

    const button = screen.getByRole('button', { name: 'Denied' })
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.tabIndex).toBe(0)
    button.focus()
    expect(document.activeElement).toBe(button)
  })

  it('takes a real disabled attribute out of the tab order', () => {
    // The control case. It is why `disabled` is never used for a role refusal: this is what it
    // costs, and the reason beside the control becomes unreachable at the same moment.
    render(<Button disabled>Off</Button>)

    const button = screen.getByRole('button', { name: 'Off' })
    button.focus()
    expect(document.activeElement).not.toBe(button)
  })

  it('styles the aria-disabled state so the refusal is visible as well as announced', () => {
    render(<Button aria-disabled="true">Denied</Button>)
    expect(screen.getByRole('button', { name: 'Denied' }).className).toContain('aria-disabled:')
  })

  it('passes aria-describedby straight through', () => {
    render(<Button aria-describedby="why-new">Denied</Button>)
    expect(screen.getByRole('button', { name: 'Denied' }).getAttribute('aria-describedby')).toBe(
      'why-new',
    )
  })
})
