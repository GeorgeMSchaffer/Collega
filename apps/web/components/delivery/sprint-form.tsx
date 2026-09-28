'use client'

import { Alert, Field, FieldRow, Input, Select, Textarea } from '@collega/design-system'
import { type FormEvent, useEffect, useId, useState, useTransition } from 'react'
import { createSprint, type SprintInput } from '@/lib/server/delivery-actions'
import type { MemberOption } from '@/lib/types'

const EMPTY: SprintInput = { name: '', goal: '', startDate: '', endDate: '', ownerUserId: '' }

/**
 * *Add New Sprint* (`20-feature-issues-and-delivery.md` "Sprint board (comp R)"): name, goal, the
 * two dates side by side and an optional owner, on `POST /sprints`. The checks here are for
 * feedback only; the API's own refusals land beside the same fields.
 */
export function SprintForm({
  formId,
  organizationId,
  members,
  onCreated,
  onPendingChange,
}: {
  formId: string
  organizationId: string
  members: MemberOption[]
  onCreated: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(EMPTY)
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => onPendingChange(pending), [pending, onPendingChange])

  const set = (key: keyof SprintInput) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const local: Record<string, string> = {}
    if (!draft.name.trim()) local.name = 'Name is required.'
    if (!draft.startDate) local.startDate = 'Start is required.'
    if (!draft.endDate) local.endDate = 'End is required.'
    else if (draft.startDate && draft.endDate < draft.startDate)
      local.endDate = 'End must be on or after the start.'
    setErrors(local)
    setError(null)
    if (Object.keys(local).length > 0) return

    startTransition(async () => {
      const result = await createSprint(organizationId, { ...draft, name: draft.name.trim() })
      if (result.ok) {
        onCreated()
        return
      }
      setErrors(result.errors)
      setError(result.error)
    })
  }

  return (
    <form id={formId} onSubmit={submit} noValidate>
      {error ? (
        <Alert variant="destructive" role="alert" className="mb-4">
          <span>{error}</span>
        </Alert>
      ) : null}
      <Field htmlFor={`${id}-name`} label="Name" required error={errors.name}>
        <Input
          id={`${id}-name`}
          required
          maxLength={100}
          value={draft.name}
          invalid={Boolean(errors.name)}
          onChange={(event) => set('name')(event.target.value)}
        />
      </Field>
      <Field htmlFor={`${id}-goal`} label="Goal" error={errors.goal}>
        <Textarea
          id={`${id}-goal`}
          rows={3}
          maxLength={500}
          value={draft.goal}
          invalid={Boolean(errors.goal)}
          onChange={(event) => set('goal')(event.target.value)}
        />
      </Field>
      <FieldRow cols={2}>
        <Field htmlFor={`${id}-start`} label="Start" required error={errors.startDate}>
          <Input
            id={`${id}-start`}
            type="date"
            required
            value={draft.startDate}
            invalid={Boolean(errors.startDate)}
            onChange={(event) => set('startDate')(event.target.value)}
          />
        </Field>
        <Field
          htmlFor={`${id}-end`}
          label="End"
          required
          hint="On or after the start."
          error={errors.endDate}
        >
          <Input
            id={`${id}-end`}
            type="date"
            required
            min={draft.startDate || undefined}
            value={draft.endDate}
            invalid={Boolean(errors.endDate)}
            onChange={(event) => set('endDate')(event.target.value)}
          />
        </Field>
      </FieldRow>
      <Field htmlFor={`${id}-owner`} label="Owner" error={errors.ownerUserId}>
        <Select
          id={`${id}-owner`}
          value={draft.ownerUserId}
          invalid={Boolean(errors.ownerUserId)}
          onChange={(event) => set('ownerUserId')(event.target.value)}
        >
          <option value="">No owner</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
      </Field>
    </form>
  )
}
