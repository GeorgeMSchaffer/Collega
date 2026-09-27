'use client'

import { cn } from '@collega/design-system'
import { type ReactNode, useId } from 'react'
import { Icon } from './icons'
import { PAGE_SIZES, type PageSize } from './list-state'

/**
 * Comp R's `.pager`: the page-size selector (10 / 25 / 50 / 100), "{from}–{to} of {total}", and
 * previous / numbered / next buttons. Past seven pages the numbers window around the current one,
 * keeping the first and last.
 */
export function Pager({
  page,
  size,
  total,
  onPageChange,
  onSizeChange,
}: {
  page: number
  size: PageSize
  total: number
  onPageChange: (page: number) => void
  onSizeChange: (size: PageSize) => void
}) {
  const sizeId = useId()
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, page), pageCount)
  const from = total === 0 ? 0 : (current - 1) * size + 1
  const to = Math.min(total, current * size)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 text-[13px] text-muted-foreground">
      <label
        htmlFor={sizeId}
        className="m-0 inline-flex items-center gap-1.5 text-[13px] font-normal"
      >
        Show
        <select
          id={sizeId}
          value={size}
          onChange={(event) => onSizeChange(Number(event.target.value) as PageSize)}
          className="h-[var(--control-h-sm)] w-auto py-0 text-[13px] text-foreground"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        per page
      </label>
      <span aria-live="polite">
        {from}–{to} of {total}
      </span>
      <nav aria-label="Pages" className="flex gap-1">
        <PageButton
          label="Previous page"
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
        >
          <Icon name="prev" />
        </PageButton>
        {pageWindow(current, pageCount).map((n) =>
          typeof n === 'string' ? (
            <span key={n} className="grid min-w-8 place-items-center" aria-hidden="true">
              …
            </span>
          ) : (
            <PageButton key={n} current={n === current} onClick={() => onPageChange(n)}>
              {n}
            </PageButton>
          ),
        )}
        <PageButton
          label="Next page"
          disabled={current === pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <Icon name="next" />
        </PageButton>
      </nav>
    </div>
  )
}

function PageButton({
  children,
  label,
  current = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  label?: string
  current?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-grid h-8 min-w-8 place-items-center rounded-md border border-input bg-card px-2 text-foreground hover:border-primary disabled:cursor-default disabled:opacity-40 disabled:hover:border-input',
        current && 'border-primary bg-primary font-semibold text-primary-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** Every page up to seven; beyond that the first, the last, and the current one ±1, with gaps. */
function pageWindow(current: number, count: number): (number | 'gap-start' | 'gap-end')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(current - 1, count - 4))
  const end = Math.min(count - 1, Math.max(current + 1, 5))
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  return [
    1,
    ...(start > 2 ? (['gap-start'] as const) : []),
    ...middle,
    ...(end < count - 1 ? (['gap-end'] as const) : []),
    count,
  ]
}
