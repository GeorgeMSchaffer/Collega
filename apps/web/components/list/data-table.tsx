'use client'

import { cn } from '@collega/design-system'
import type { ReactNode } from 'react'
import { Icon } from './icons'
import { nextSort, type Sort } from './list-state'

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Every displayed column sorts by default (comp R); `false` opts one out. */
  sortable?: boolean
  /** Tabular figures, for counts and dates. */
  numeric?: boolean
  className?: string
}

/**
 * Comp R's list table: sortable headers that cycle ascending → descending → off with `aria-sort`
 * on the active one, and an Actions column at the right when `actions` is given.
 *
 * Presentational: it renders the rows it is handed in the order it is handed them. Sorting the data
 * is the screen's (in the API for ideas, `sortRows` for boards). A client component, because the
 * column definitions carry functions — build the table inside the screen's client component.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  actions,
  empty = 'Nothing matches these filters.',
  selectedKey,
}: {
  /** Names the table for assistive technology; rendered visually hidden. */
  caption: string
  columns: readonly Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  sort: Sort | null
  onSortChange: (sort: Sort | null) => void
  actions?: (row: T) => ReactNode
  empty?: ReactNode
  /** The row whose drawer is open, marked `aria-current`. */
  selectedKey?: string | null
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-[720px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key ? sort.dir : null
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined
                  }
                  className={cn('whitespace-nowrap px-3.5', column.className)}
                >
                  {column.sortable === false ? (
                    column.header
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSortChange(nextSort(sort, column.key))}
                      className={cn(
                        'inline-flex items-center gap-1 font-medium hover:text-foreground',
                        active && 'text-foreground',
                      )}
                    >
                      {column.header}
                      <Icon
                        name={active === 'asc' ? 'asc' : active === 'desc' ? 'desc' : 'sort'}
                        className={cn('size-3', !active && 'opacity-40')}
                      />
                    </button>
                  )}
                </th>
              )
            })}
            {actions ? (
              <th scope="col" className="w-px whitespace-nowrap px-3.5 text-right">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row)
              return (
                <tr key={key} aria-current={selectedKey === key ? 'true' : undefined}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3.5',
                        column.numeric && 'tabular-nums',
                        selectedKey === key && 'bg-accent/60',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {actions ? (
                    <td
                      className={cn(
                        'w-px whitespace-nowrap px-3.5 text-right',
                        selectedKey === key && 'bg-accent/60',
                      )}
                    >
                      {actions(row)}
                    </td>
                  ) : null}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
