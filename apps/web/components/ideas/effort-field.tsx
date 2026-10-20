'use client'

import { cn, EffortBar } from '@collega/design-system'
import { useId } from 'react'
import type { Effort } from '@/lib/types'

const EFFORTS: Effort[] = ['Low', 'Medium', 'High']

/**
 * The idea form's Effort (comp U screen 5): Low, Medium or High as native radios, so the arrow keys
 * and one tab stop come free, and a Clear that sends `null`. Optional to save; the helper says when
 * a board's reference lane will ask for it. The error is keyed `effort` like the API's.
 */
export function EffortField({
  value,
  onChange,
  onClear,
  error,
  hint,
}: {
  value: Effort | ''
  onChange: (effort: Effort) => void
  onClear: () => void
  error?: string | undefined
  hint: string
}) {
  const id = useId()
  const messageId = `${id}-msg`
  return (
    <fieldset
      className="m-0 mb-4 border-0 p-0"
      data-invalid={error ? '' : undefined}
      aria-describedby={messageId}
    >
      <legend className="mb-[5px] text-[length:var(--label-size)] font-medium text-secondary-foreground">
        Effort
      </legend>
      <div role="radiogroup" className="flex flex-wrap items-center gap-2">
        {EFFORTS.map((option, index) => (
          <div key={option} className="relative">
            <input
              type="radio"
              id={`${id}-${option}`}
              name={`${id}-effort`}
              value={option}
              data-error-key={index === 0 ? 'effort' : undefined}
              checked={value === option}
              aria-invalid={error ? true : undefined}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <label
              htmlFor={`${id}-${option}`}
              className={cn(
                'm-0 flex cursor-pointer items-center rounded-md border bg-card px-3 py-2 font-medium',
                'hover:bg-muted peer-checked:border-ring peer-checked:bg-accent peer-checked:text-accent-foreground',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                error ? 'border-destructive' : 'border-input',
              )}
            >
              <EffortBar effort={option} className="text-sm text-foreground" />
            </label>
          </div>
        ))}
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <span
        id={messageId}
        className={cn(
          'mt-1 block text-xs',
          error ? 'font-semibold text-destructive' : 'text-muted-foreground',
        )}
      >
        {error ?? hint}
      </span>
    </fieldset>
  )
}
