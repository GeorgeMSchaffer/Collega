import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RefPill } from '../src/components/ref-pill.js'

// Comp U's `.refpill`: the mark a referencing lane carries.

describe('RefPill', () => {
  it('shows the target key prefix after an arrow that assistive technology skips', () => {
    const { container } = render(<RefPill>IMPL</RefPill>)
    expect(container.textContent).toBe('↳IMPL')
    const arrow = container.querySelector('[aria-hidden="true"]')
    expect(arrow?.textContent).toBe('↳')
    expect(screen.getByText('IMPL')).toBeTruthy()
  })

  it('renders whatever fallback text the caller passes for a board with no prefix', () => {
    render(<RefPill>board reference</RefPill>)
    expect(screen.getByText('board reference')).toBeTruthy()
  })

  it('merges a caller class and forwards other attributes onto the span', () => {
    render(
      <RefPill className="extra" data-testid="pill">
        IMPL
      </RefPill>,
    )
    const pill = screen.getByTestId('pill')
    expect(pill.tagName).toBe('SPAN')
    expect(pill.classList.contains('extra')).toBe(true)
    expect(pill.classList.contains('font-mono')).toBe(true)
  })
})
