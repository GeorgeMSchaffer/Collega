'use client'

import { cn, EffortBar, Field, Select } from '@collega/design-system'
import { useId } from 'react'
import type { Effort, Sprint } from '@/lib/types'

const EFFORTS: Effort[] = ['Low', 'Medium', 'High']

/**
 * The two fields only an added Issue has, drawn as the create drawer's "Delivery" group (comp A,
 * `20-feature-issues-and-delivery.md` "Backlog: add and edit"): Effort, required with no default as
 * at the promotion gate, and an optional Sprint that defaults to the Backlog. There is no Board or
 * Status here — an Issue has neither.
 *
 * Effort is native radios, so the arrow keys and a single tab stop come for free; the bar is
 * decoration beside the word. The errors are the form's, keyed `effort` and `sprintId`.
 */
export function IssueDeliveryFields({
  effort,
  sprintId,
  sprints,
  errors,
  onEffort,
  onSprint,
}: {
  effort: Effort | ''
  sprintId: string
  /** The sprints to offer: the caller has already left out the `Completed` ones. */
  sprints: readonly Pick<Sprint, 'id' | 'name' | 'state'>[]
  errors: Readonly<Record<string, string>>
  onEffort: (effort: Effort) => void
  onSprint: (sprintId: string) => void
}) {
  const id = useId()
  const messageId = `${id}-effort-msg`
  const error = errors.effort

  return (
    <fieldset className="m-0 mb-4 flex flex-col gap-1 border-0 border-t p-0 pt-3">
      <legend className="float-left mb-1 w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Delivery
      </legend>
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        Where this issue sits in the plan. Board and status are not asked here.
      </p>

      <fieldset
        className="m-0 mb-4 border-0 p-0"
        data-invalid={error ? '' : undefined}
        aria-describedby={error ? messageId : undefined}
      >
        <legend className="mb-[5px] text-[length:var(--label-size)] font-medium text-secondary-foreground">
          Effort
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        </legend>
        <div role="radiogroup" className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          {EFFORTS.map((option, index) => (
            <div key={option} className="relative">
              <input
                type="radio"
                id={`${id}-effort-${option}`}
                name={`${id}-effort`}
                value={option}
                data-error-key={index === 0 ? 'effort' : undefined}
                required
                checked={effort === option}
                aria-invalid={error ? true : undefined}
                onChange={() => onEffort(option)}
                className="peer sr-only"
              />
              <label
                htmlFor={`${id}-effort-${option}`}
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
        </div>
        {error ? (
          <span id={messageId} className="mt-1 block text-xs font-semibold text-destructive">
            {error}
          </span>
        ) : null}
      </fieldset>

      <Field
        htmlFor={`${id}-sprint`}
        label="Sprint (optional)"
        hint="Defaults to Backlog. Completed sprints are not listed."
        error={errors.sprintId}
        className="mb-0"
      >
        <Select
          id={`${id}-sprint`}
          data-error-key="sprintId"
          value={sprintId}
          onChange={(event) => onSprint(event.target.value)}
          aria-invalid={errors.sprintId ? true : undefined}
        >
          <option value="">Backlog</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} ({sprint.state.toLowerCase()})
            </option>
          ))}
        </Select>
      </Field>
    </fieldset>
  )
}
