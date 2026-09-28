import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EffortBar } from '../src/components/effort-bar.js'

// `20-feature-client-ui.md` "Tag colours and the effort bar".

describe('EffortBar', () => {
  it.each([
    ['Low', 1],
    ['Medium', 2],
    ['High', 3],
  ] as const)('shows %s effort with %i of three segments filled', (effort, filled) => {
    const { container } = render(<EffortBar effort={effort} />)
    expect(container.textContent).toBe(`${effort} effort`)
    const bar = container.querySelector('[aria-hidden="true"]') as HTMLElement
    const segments = [...bar.children]
    expect(segments).toHaveLength(3)
    expect(segments.map((s) => s.classList.contains('bg-metric'))).toEqual(
      [1, 2, 3].map((n) => n <= filled),
    )
    expect(segments.filter((s) => s.classList.contains('bg-input'))).toHaveLength(3 - filled)
  })

  it('hides the bar from assistive technology and leaves the words readable', () => {
    render(<EffortBar effort="Medium" />)
    expect(screen.getByText('Medium effort')).toBeTruthy()
    const { container } = render(<EffortBar effort="High" />)
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('')
  })
})
