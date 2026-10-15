'use client'

import { Button, cn, Input, Kbd, Select } from '@collega/design-system'
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react'
import { useToast } from '@/components/delivery/toast'
import { Icon } from './icons'
import { useAddedHighlight } from './use-added-highlight'

/** What `DataTable` tells its `quickAdd` slot, so the row lines its cells up with the columns. */
export type QuickAddLayout = {
  columns: readonly { key: string }[]
  hasActions: boolean
}

export type QuickAddValues = Readonly<Record<string, string>>

export type QuickAddField = {
  /** The key in the values handed to `onSubmit` / `onHandoff`, and in a result's `errors`. */
  name: string
  /** The accessible name; the column header is what sighted users read. */
  label: string
  /** The column this field sits under. Defaults to the first column for Title, else under Title. */
  column?: string
  required?: boolean
  /** Shown beside the control when a required field is empty. */
  requiredMessage?: string
  /** A select when given, a text input otherwise. */
  options?: readonly { value: string; label: string }[]
  /** The empty option of a select ("Choose effort"), or a text input's placeholder. */
  placeholder?: string
  /** Pre-selected, and what an optional select keeps after an add (Sprint, say). */
  defaultValue?: string
  maxLength?: number
}

export type QuickAddResult =
  | {
      ok: true
      /** The new row's id, to scroll to and highlight; omit when it is not in this list. */
      id?: string | null
      /** The toast and the announcement, e.g. "Issue added" or "Issue added to Sprint 14". */
      message?: string
    }
  | { ok: false; error: string | null; errors: Readonly<Record<string, string>> }

type Mode =
  | {
      /** Enter never creates: it opens the drawer pre-populated with the row's values. */
      handoff: 'drawer'
      onHandoff: (values: QuickAddValues) => void
      onSubmit?: never
    }
  | {
      /** Enter creates straight away; "More fields" still hands off when `onHandoff` is given. */
      handoff: 'create'
      onSubmit: (values: QuickAddValues) => Promise<QuickAddResult>
      onHandoff?: (values: QuickAddValues) => void
    }

/**
 * The quick-add row (`20-feature-client-ui.md` "Quick-add row"): a spreadsheet-style row at the
 * top of a list that takes the minimum fields. Pass it to `DataTable`'s `quickAdd` slot.
 *
 * Title is always `fields[0]`. Enter in any control submits; Escape clears the row. Add is outline
 * until the required fields are set, then primary, and is always clickable so a refusal can say
 * why. Errors sit beside their field with `aria-invalid`, and focus goes to the first one. On
 * success Title and required selects clear, optional selects keep their value, focus returns to
 * Title, a polite live region and the toast announce it, and the new row is scrolled into view and
 * highlighted where the active sort puts it. `canAdd` false renders nothing (Read Only); the row is
 * hidden below `md` (the header button is the phone path).
 *
 * A table row cannot hold a `<form>`, so Enter and Escape are handled on the row itself. After a
 * hand-off the row clears: the drawer now owns the values.
 */
export function QuickAddRow({
  layout,
  fields,
  canAdd,
  label,
  addLabel = 'Add',
  addingLabel = 'Adding…',
  moreLabel = 'More fields',
  hint,
  rowIds,
  rowSelector,
  testId,
  ...mode
}: {
  layout: QuickAddLayout
  fields: readonly QuickAddField[]
  /** False hides the row entirely. */
  canAdd: boolean
  /** The row's accessible name, e.g. "Quick add issue". */
  label: string
  addLabel?: string
  addingLabel?: string
  moreLabel?: string
  /** Extra line under Title, e.g. what the drawer will default. */
  hint?: ReactNode
  /** The list's current row ids joined, so the highlight can wait for the refreshed list. */
  rowIds: string
  /** How to find a row by id; defaults to `DataTable`'s `data-row-key`. */
  rowSelector?: (id: string) => string
  testId: string
} & Mode) {
  const baseId = useId()
  const rowRef = useRef<HTMLTableRowElement>(null)
  const initial = (): Record<string, string> =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? '']))
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [toast, showToast] = useToast()
  const highlight = useAddedHighlight(rowIds, rowSelector)

  if (!canAdd) return null

  const titleField = fields[0]
  const titleColumn = titleField?.column ?? layout.columns[0]?.key
  const columnOf = (field: QuickAddField) => field.column ?? titleColumn
  const ready = fields.every((f) => !f.required || values[f.name]?.trim())
  const dirty = fields.some((f) => values[f.name] !== (f.defaultValue ?? ''))
  const state = saving
    ? 'saving'
    : Object.keys(errors).length > 0 || formError
      ? 'error'
      : dirty
        ? 'typing'
        : 'idle'
  const focusField = (name: string) =>
    rowRef.current?.querySelector<HTMLElement>(`[data-qa-field="${CSS.escape(name)}"]`)?.focus()

  const set = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    if (errors[name] || formError) {
      setErrors(({ [name]: _cleared, ...rest }) => rest)
      setFormError(null)
    }
  }

  const reset = () => {
    setValues(initial())
    setErrors({})
    setFormError(null)
  }

  const clearAfterAdd = () => {
    setValues((current) =>
      Object.fromEntries(
        fields.map((f) => [
          f.name,
          // Optional selects keep their value: people batch into one sprint.
          f.options && !f.required ? (current[f.name] ?? '') : (f.defaultValue ?? ''),
        ]),
      ),
    )
    setErrors({})
    setFormError(null)
  }

  const refuse = (found: Readonly<Record<string, string>>, general: string | null) => {
    setErrors(found)
    setFormError(general)
    const first = fields.find((f) => found[f.name])
    // Deferred: after a server refusal the controls are still disabled until `saving` clears.
    if (first) requestAnimationFrame(() => focusField(first.name))
    const count = Object.keys(found).length
    setAnnouncement(
      count === 0
        ? `Not added. ${general ?? ''}`.trim()
        : `Not added. ${count} ${count === 1 ? 'field needs' : 'fields need'} attention.`,
    )
  }

  const trimmed = (): QuickAddValues =>
    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))

  const missing = () =>
    Object.fromEntries(
      fields
        .filter((f) => f.required && !values[f.name]?.trim())
        .map((f) => [
          f.name,
          f.requiredMessage ??
            (f.options ? `Choose ${f.label.toLowerCase()}.` : `Enter ${f.label.toLowerCase()}.`),
        ]),
    )

  const moreFields = () => {
    if (saving || !mode.onHandoff) return
    mode.onHandoff(trimmed())
    reset()
  }

  const submit = async () => {
    if (saving) return
    const absent = missing()
    if (Object.keys(absent).length > 0) return refuse(absent, null)
    setErrors({})
    setFormError(null)

    if (mode.handoff === 'drawer') {
      mode.onHandoff(trimmed())
      reset()
      return
    }

    setSaving(true)
    let result: QuickAddResult
    try {
      result = await mode.onSubmit(trimmed())
    } finally {
      setSaving(false)
    }
    if (!result.ok) return refuse(result.errors, result.error)
    const message = result.message ?? 'Added'
    clearAfterAdd()
    // The toast is itself a status region, so the row does not announce the success a second time.
    showToast(message)
    highlight(result.id ?? null)
    // The controls were disabled while saving; focus can only land once they are enabled again.
    requestAnimationFrame(() => focusField(titleField?.name ?? ''))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (saving || event.nativeEvent.isComposing) return
    const target = event.target as HTMLElement
    if (
      event.key === 'Enter' &&
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
    ) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      if (dirty || Object.keys(errors).length > 0) {
        event.preventDefault()
        reset()
        focusField(titleField?.name ?? '')
      } else {
        target.blur()
      }
    }
  }

  const control = (field: QuickAddField) => {
    const id = `${baseId}-${field.name}`
    const error = errors[field.name]
    const common = {
      id,
      'data-qa-field': field.name,
      'data-testid': `${testId}-${field.name}`,
      'aria-label': field.label,
      'aria-required': field.required || undefined,
      'aria-describedby': error ? `${id}-error` : undefined,
      invalid: !!error,
      disabled: saving,
    }
    return (
      <div key={field.name} className="flex min-w-0 flex-col gap-1">
        {field.options ? (
          <Select
            {...common}
            value={values[field.name] ?? ''}
            onChange={(event) => set(field.name, event.target.value)}
          >
            {field.placeholder !== undefined ? <option value="">{field.placeholder}</option> : null}
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            {...common}
            autoComplete="off"
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            value={values[field.name] ?? ''}
            onChange={(event) => set(field.name, event.target.value)}
          />
        )}
        {error ? (
          <span
            id={`${id}-error`}
            className="flex items-start gap-1 text-xs font-semibold text-destructive"
          >
            <Icon name="alert" className="mt-0.5 size-3 shrink-0" />
            {error}
          </span>
        ) : null}
      </div>
    )
  }

  // Always clickable: a dead button cannot say what is missing.
  const addButton = (
    <Button
      type="button"
      size="sm"
      variant={ready ? 'default' : 'outline'}
      aria-busy={saving || undefined}
      data-testid={`${testId}-add`}
      onClick={() => void submit()}
    >
      {saving ? addingLabel : addLabel}
    </Button>
  )

  const lastKey = layout.columns[layout.columns.length - 1]?.key

  return (
    <tr
      ref={rowRef}
      aria-label={label}
      aria-busy={saving || undefined}
      data-testid={testId}
      data-state={state}
      onKeyDown={onKeyDown}
      className="max-md:hidden [&>td]:border-b [&>td]:bg-muted/50 [&>td]:py-2 [&>td]:align-top"
    >
      {layout.columns.map((column) => {
        const here = fields.filter((f) => columnOf(f) === column.key)
        const isTitle = column.key === titleColumn
        const withAdd = !layout.hasActions && column.key === lastKey
        return (
          <td key={column.key} className="px-3.5">
            {here.length > 0 || isTitle || withAdd ? (
              <div className={cn('flex flex-col gap-1.5', withAdd && 'items-start')}>
                {here.map(control)}
                {withAdd ? addButton : null}
                {isTitle ? (
                  <>
                    {formError ? (
                      <span role="alert" className="text-xs font-semibold text-destructive">
                        {formError}
                      </span>
                    ) : null}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {mode.onHandoff ? (
                        <button
                          type="button"
                          onClick={moreFields}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {moreLabel}
                        </button>
                      ) : null}
                      {hint ? <span>{hint}</span> : null}
                      <span>
                        <Kbd>Enter</Kbd> {mode.handoff === 'drawer' ? 'opens the form' : 'adds'}
                        {' · '}
                        <Kbd>Esc</Kbd> clears
                      </span>
                    </span>
                    <span aria-live="polite" className="sr-only">
                      {announcement}
                    </span>
                    {toast}
                  </>
                ) : null}
              </div>
            ) : null}
          </td>
        )
      })}
      {layout.hasActions ? (
        <td className="w-px whitespace-nowrap px-3.5 text-right">{addButton}</td>
      ) : null}
    </tr>
  )
}
