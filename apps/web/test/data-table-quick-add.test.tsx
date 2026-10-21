import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { type Column, DataTable, type QuickAddLayout } from '@/components/list'

/** The `quickAdd` slot of `DataTable`: the first body row, told the columns and whether there are actions. */
type Row = { id: string; name: string }
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', cell: (r) => r.name },
  { key: 'other', header: 'Other', cell: () => 'x' },
]
const ROWS: Row[] = [
  { id: 'r1', name: 'First' },
  { id: 'r2', name: 'Second' },
]

function table(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return (
    <DataTable<Row>
      caption="Things"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(r) => r.id}
      sort={null}
      onSortChange={() => {}}
      {...props}
    />
  )
}

const slot = (layout: QuickAddLayout) => (
  <tr data-testid="slot">
    <td>{layout.columns.map((c) => c.key).join('|')}</td>
    <td>{String(layout.hasActions)}</td>
  </tr>
)

describe('DataTable quickAdd slot', () => {
  it('renders the slot as the first body row, before the data rows', () => {
    render(table({ quickAdd: slot }))
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement
    const rows = within(body).getAllByRole('row')
    expect(
      rows.map((r) => r.getAttribute('data-testid') ?? r.getAttribute('data-row-key')),
    ).toEqual(['slot', 'r1', 'r2'])
  })

  it('tells the slot the columns in order and that there are no actions', () => {
    render(table({ quickAdd: slot }))
    const cells = within(screen.getByTestId('slot')).getAllByRole('cell')
    expect(cells[0]?.textContent).toBe('name|other')
    expect(cells[1]?.textContent).toBe('false')
  })

  it('tells the slot there are actions when the table has an Actions column', () => {
    const quickAdd = vi.fn(slot)
    render(table({ quickAdd, actions: () => <button type="button">Edit</button> }))
    expect(quickAdd).toHaveBeenCalledWith({ columns: COLUMNS, hasActions: true })
  })

  it('renders only the data rows when the slot is absent', () => {
    render(table())
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement
    expect(within(body).getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByTestId('slot')).toBeNull()
  })

  it('keeps the empty message beneath the slot when there are no rows', () => {
    render(table({ rows: [], quickAdd: slot, empty: 'Nothing yet' }))
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement
    const rows = within(body).getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.getAttribute('data-testid')).toBe('slot')
    expect(rows[1]?.textContent).toBe('Nothing yet')
  })

  it('stamps each data row with data-row-key, which the added-row highlight finds it by', () => {
    render(table({ quickAdd: slot }))
    expect(document.querySelector('[data-row-key="r2"]')?.textContent).toContain('Second')
  })

  it('renders an empty slot as no extra row when the slot returns nothing', () => {
    render(table({ quickAdd: () => null }))
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement
    expect(within(body).getAllByRole('row')).toHaveLength(2)
  })
})
