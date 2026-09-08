import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IdeasTable } from '@/components/ideas/ideas-table'
import { boards, ideas, statuses } from '@/lib/mock'

/**
 * Which row the inspector is showing, and how a reader can tell.
 *
 * `aria-current` names the row for assistive technology, and it must land on exactly one — a
 * second one makes the answer "which idea is open?" ambiguous, and zero makes it unanswerable.
 *
 * The visual half is carried by two channels on purpose: a left rule (geometry) and a ground tint
 * (colour). Colour alone would vanish in greyscale, under a high-contrast theme, or for a reader
 * who cannot separate the tint from the hover state. jsdom applies no stylesheet, so the utilities
 * themselves are the only available evidence that both channels exist.
 */
const SELECTED = ideas[0]
const OTHER = ideas[1]

function bodyRows(): HTMLElement[] {
  const [, body] = screen.getAllByRole('rowgroup')
  if (!body) throw new Error('the table rendered no body')
  return within(body).getAllByRole('row')
}

function rowFor(title: string): HTMLElement {
  const row = bodyRows().find((candidate) => within(candidate).queryByText(title) !== null)
  if (!row) throw new Error(`no row for ${title}`)
  return row
}

describe('IdeasTable selection', () => {
  it('marks exactly one row current', () => {
    if (!SELECTED) throw new Error('the fixture seeds no ideas')
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} selectedId={SELECTED.id} />)

    const current = bodyRows().filter((row) => row.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
  })

  it('marks the selected idea and not its neighbour', () => {
    if (!SELECTED || !OTHER) throw new Error('the fixture seeds too few ideas')
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} selectedId={SELECTED.id} />)

    expect(rowFor(SELECTED.title).getAttribute('aria-current')).toBe('true')
    expect(rowFor(OTHER.title).getAttribute('aria-current')).toBeNull()
  })

  it('marks no row current when nothing is open', () => {
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} />)
    expect(bodyRows().filter((row) => row.hasAttribute('aria-current'))).toEqual([])
  })

  it('marks nothing when the selected id is not in the rows', () => {
    render(
      <IdeasTable rows={ideas} boards={boards} statuses={statuses} selectedId="no-such-idea" />,
    )
    expect(bodyRows().filter((row) => row.hasAttribute('aria-current'))).toEqual([])
  })

  it('renders every row it is given', () => {
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} />)
    expect(bodyRows()).toHaveLength(ideas.length)
  })
})

describe('IdeasTable selection is legible without colour', () => {
  it('carries the selection on a rule the selected row alone has', () => {
    if (!SELECTED || !OTHER) throw new Error('the fixture seeds too few ideas')
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} selectedId={SELECTED.id} />)

    const selectedCell = within(rowFor(SELECTED.title)).getAllByRole('cell')[0]
    const otherCell = within(rowFor(OTHER.title)).getAllByRole('cell')[0]

    expect(selectedCell?.className).toContain('border-l-[3px]')
    expect(otherCell?.className).not.toContain('border-l-[3px]')
  })

  it('keys the ground tint to the same attribute assistive technology reads', () => {
    // Two channels that can disagree are worse than one. The tint is a CSS condition on
    // `aria-current`, so a row cannot be tinted without also being announced.
    if (!SELECTED) throw new Error('the fixture seeds no ideas')
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} selectedId={SELECTED.id} />)

    expect(rowFor(SELECTED.title).className).toContain('aria-[current]:bg-')
  })

  it('does not rely on the tint alone', () => {
    if (!SELECTED) throw new Error('the fixture seeds no ideas')
    render(<IdeasTable rows={ideas} boards={boards} statuses={statuses} selectedId={SELECTED.id} />)

    const row = rowFor(SELECTED.title)
    const cellClasses = within(row)
      .getAllByRole('cell')
      .map((cell) => cell.className)
      .join(' ')

    // A border utility is geometry, not colour: it survives greyscale and a forced-colours theme.
    expect(cellClasses).toMatch(/border-l-\[\d+px\]/)
  })
})
