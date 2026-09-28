'use client'

import { cn } from '@collega/design-system'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { Icon } from './icons'

export type FilterOption = string | { value: string; label: string }

const optionValue = (option: FilterOption) => (typeof option === 'string' ? option : option.value)
const optionLabel = (option: FilterOption) => (typeof option === 'string' ? option : option.label)

/**
 * Comp R's `.ms`: a pill button naming the filter and what it holds ("Status: Complete",
 * "Status: 2 selected"), opening a popover with type-to-find, a checkbox per value and a Clear.
 *
 * The popover is a non-modal `dialog`: Escape, a click outside or tabbing out of it closes it, and
 * Escape returns focus to the button. Each tick reports at once, so the list behind updates while
 * the popover stays open.
 *
 * `onFindChange` hears the type-to-find text, for a filter whose values are too many to hand over
 * up front (Tags): the screen looks matches up and passes them back in as `options`.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  onFindChange,
}: {
  /** The column's name, e.g. "Status". */
  label: string
  options: readonly FilterOption[]
  selected: readonly string[]
  onChange: (next: string[]) => void
  onFindChange?: (find: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [find, setFind] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    const element = root.current
    const onPointerDown = (event: PointerEvent) => {
      if (!element?.contains(event.target as Node)) setOpen(false)
    }
    // Tabbing out of the popover closes it too. A `null` destination is a click on the popover's
    // own padding, which the pointer handler judges.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null
      if (next && !element?.contains(next)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    element?.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      element?.removeEventListener('focusout', onFocusOut)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Claimed here, so an open drawer behind the toolbar does not close on the same key.
      event.preventDefault()
      close()
    }
  }

  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value))

  const needle = find.trim().toLowerCase()
  const shown = options.filter((option) => optionLabel(option).toLowerCase().includes(needle))
  const firstSelected = options.find((option) => optionValue(option) === selected[0])
  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? optionLabel(firstSelected ?? selected[0] ?? '')
        : `${selected.length} selected`

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-haspopup="dialog"
        onKeyDown={onKeyDown}
        onClick={() => {
          setFind('')
          setOpen(!open)
        }}
        className={cn(
          'inline-flex h-[var(--control-h-sm)] items-center gap-1.5 rounded-full border border-input bg-card px-3 text-[13px] text-foreground hover:border-primary',
          summary && 'border-primary bg-accent font-semibold text-accent-foreground',
        )}
      >
        {label}
        {summary ? `: ${summary}` : null}
        <Icon name="down" className="size-3.5" />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${label} filter`}
          onKeyDown={onKeyDown}
          className="absolute top-[calc(100%+6px)] left-0 z-30 flex w-60 flex-col gap-1 rounded-lg border border-input bg-popover p-2 text-popover-foreground shadow-[0_12px_32px_rgb(var(--shadow-rgb)/.18)]"
        >
          <input
            type="search"
            // biome-ignore lint/a11y/noAutofocus: opening the popover is asking to type into it
            autoFocus
            value={find}
            onChange={(event) => {
              setFind(event.target.value)
              onFindChange?.(event.target.value)
            }}
            placeholder="Type to find…"
            aria-label={`Find ${label.toLowerCase()}`}
            className="h-[var(--control-h-sm)]"
          />
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {shown.length === 0 ? (
              <span className="px-1.5 py-1 text-xs text-muted-foreground">No match</span>
            ) : (
              shown.map((option) => {
                const value = optionValue(option)
                return (
                  <label
                    key={value}
                    className="m-0 flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-sm font-normal leading-snug hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(value)}
                      onChange={(event) => toggle(value, event.target.checked)}
                    />
                    {optionLabel(option)}
                  </label>
                )
              })
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="self-start rounded-sm px-1.5 py-1 text-xs font-medium text-accent-foreground hover:underline disabled:opacity-50"
          >
            Clear {label.toLowerCase()}
          </button>
        </div>
      ) : null}
    </div>
  )
}
