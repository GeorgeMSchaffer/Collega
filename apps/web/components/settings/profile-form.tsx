'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import { useActionState } from 'react'
import { type ProfileState, updateProfile } from '@/lib/server/auth-actions'

/**
 * A `'use server'` module may only export async functions, so this cannot live beside the action —
 * every other export is replaced by a reference the client cannot resolve, and the first
 * `state.errors` lookup would throw during prerender. `tsc` sees a perfectly good import and says
 * nothing; only `next build` catches it. See `register-form.tsx`, which learned this first.
 */
const NOTHING_SUBMITTED: ProfileState = {
  error: null,
  errors: {},
  values: { firstName: '', lastName: '' },
  saved: false,
}

/**
 * Rename yourself (comp P `s-profile`, "Profile details").
 *
 * A client component only for `useActionState` — the pending flag, the field errors, and the saved
 * note.
 *
 * Email and role are rendered here rather than beside the form because comp P puts all four in one
 * two-column grid, and splitting them would reorder the screen. They are read-only and
 * `updateProfile` never reads them, so the browser posting them alongside the names changes
 * nothing: `PUT /auth/me` takes two fields and refuses to change either of these.
 *
 * The saved note is comp P's own idiom for a confirmed write — a quiet line beside the button
 * rather than a banner or a toast (`comp-p-admin.html`, the AI scope statement's *"Saved. Takes
 * effect on the next turn."*). `role="status"` and not `alert`: nothing went wrong.
 *
 * `defaultValue` echoes the submitted values on a refusal and the server-rendered profile
 * otherwise. React resets an uncontrolled form when its action resolves, so without the echo a
 * refused save would blank a name the person had just corrected. A *successful* save wants the
 * other branch: `updateProfile` revalidates, so the prop is the value that was just stored.
 *
 * Keyed off `error` rather than off whether the values look filled in. Clearing both names is a
 * refusal whose submitted values are two empty strings, and a form that decides "nothing was
 * submitted" from that repopulates the fields with the old name while printing "is required."
 * beside it — which is the one state this echo exists to prevent.
 */
export function ProfileForm({
  firstName,
  lastName,
  email,
  roleLabel,
}: {
  firstName: string
  lastName: string
  email: string
  roleLabel: string
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    NOTHING_SUBMITTED,
  )
  const refused = state.error !== null

  return (
    <form action={formAction}>
      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>{state.error}</span>
        </Alert>
      ) : null}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field htmlFor="firstName" label="First name" error={state.errors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={refused ? state.values.firstName : firstName}
            invalid={Boolean(state.errors.firstName)}
          />
        </Field>
        <Field htmlFor="lastName" label="Last name" error={state.errors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={refused ? state.values.lastName : lastName}
            invalid={Boolean(state.errors.lastName)}
          />
        </Field>
        <Field
          htmlFor="email"
          label="Email"
          hint="Email is your sign-in identity and cannot be changed here."
        >
          <Input id="email" name="email" readOnly defaultValue={email} />
        </Field>
        <Field htmlFor="role" label="Role" hint="Your role is set by an administrator.">
          <Input id="role" name="role" readOnly defaultValue={roleLabel} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </Button>
        {state.saved ? (
          <span className="text-sm text-muted-foreground" role="status">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  )
}
