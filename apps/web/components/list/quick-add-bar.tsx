'use client'

import { Button, cn, Input } from '@collega/design-system'
import { type KeyboardEvent, useState } from 'react'
import { useToast } from '@/components/delivery/toast'

export type QuickAddValues = Readonly<Record<string, string>>

export type QuickAddField = {
  name: string
  label: string
  column?: string
  required?: boolean
  requiredMessage?: string
  options?: readonly { value: string; label: string }[]
  placeholder?: string
  defaultValue?: string
  maxLength?: number
}

export type QuickAddResult =
  | {
      ok: true
      id?: string | null
      message?: string
    }
  | { ok: false; error: string | null; errors: Readonly<Record<string, string>> }

type Mode =
  | {
      handoff: 'drawer'
      onHandoff: (values: QuickAddValues) => void
      onSubmit?: never
    }
  | {
      handoff: 'create'
      onSubmit: (values: QuickAddValues) => Promise<QuickAddResult>
      onHandoff?: (values: QuickAddValues) => void
    }

export function QuickAddBar({
  fields,
  canAdd,
  label,
  moreLabel = 'More fields',
  testId,
  ...mode
}: {
  fields: readonly QuickAddField[]
  canAdd: boolean
  label: string
  moreLabel?: string
  testId: string
} & Mode) {
  const initial = (): Record<string, string> =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? '']))
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [toast, showToast] = useToast()

  if (!canAdd) return null

  const titleField = fields[0]
  const invalid = formError !== null || Object.keys(errors).length > 0
  const dirty = fields.some((f) => values[f.name] !== (f.defaultValue ?? ''))

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

  const refuse = (found: Readonly<Record<string, string>>, general: string | null) => {
    setErrors(found)
    setFormError(general)
    setAnnouncement(
      Object.keys(found).length === 0
        ? `Not added. ${general ?? ''}`.trim()
        : `Not added. ${Object.keys(found).length} ${Object.keys(found).length === 1 ? 'field needs' : 'fields need'} attention.`,
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
    reset()
    showToast(result.message ?? 'Added')
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (saving || event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      if (dirty || Object.keys(errors).length > 0) {
        event.preventDefault()
        reset()
      }
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 border border-dashed rounded-md bg-transparent',
        invalid && 'border-destructive',
      )}
      data-testid={testId}
    >
      <span className="text-primary text-lg">＋</span>
      <Input
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none"
        placeholder={titleField?.placeholder}
        value={values[titleField?.name ?? ''] ?? ''}
        onChange={(e) => set(titleField?.name ?? '', e.target.value)}
        onKeyDown={onKeyDown}
        disabled={saving}
      />
      {invalid ? (
        <span role="alert" className="text-xs text-destructive">
          {formError ?? Object.values(errors)[0]}
        </span>
      ) : null}
      <Button size="sm" variant="outline" onClick={moreFields} className="h-7 text-xs">
        {moreLabel}
      </Button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {toast}
    </div>
  )
}
