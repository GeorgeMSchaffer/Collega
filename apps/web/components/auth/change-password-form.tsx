'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import { useActionState } from 'react'
import { changePassword, type PasswordState } from '@/lib/server/auth-actions'

/** For the reason `register-form.tsx` gives: a `'use server'` module exports only async functions. */
const NOTHING_SUBMITTED: PasswordState = { error: null, errors: {} }

/**
 * The forced first-sign-in rotation (comp Q `s-first-signin`).
 *
 * Carries the same three accessibility properties as the sign-in form, and comp P says they matter
 * here more than anywhere — this is a new user's second interaction with the product: a native
 * `<button type="submit">` so Enter submits, real `<label for>` bindings, and `current-password`
 * beside two `new-password` fields so a password manager offers to replace the stored credential
 * rather than fill it.
 *
 * A client component only for `useActionState`. None of the three fields is controlled, so no
 * password reaches client state — they go straight into the `FormData` the framework serializes.
 *
 * Success is a redirect out of this screen, not a state: the change invalidates the session it was
 * made with, so there is nothing left here to render. `changePassword` explains why.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    NOTHING_SUBMITTED,
  )

  return (
    <>
      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>{state.error}</span>
        </Alert>
      ) : null}

      <form action={formAction}>
        <Field
          htmlFor="currentPassword"
          label="Current password"
          error={state.errors.currentPassword}
          hint="The temporary password you just signed in with."
        >
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(state.errors.currentPassword)}
          />
        </Field>
        <Field
          htmlFor="newPassword"
          label="New password"
          error={state.errors.newPassword}
          hint="At least 6 characters, with an uppercase letter, a lowercase letter, a number and a symbol."
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(state.errors.newPassword)}
          />
        </Field>
        <Field
          htmlFor="confirmPassword"
          label="Confirm new password"
          error={state.errors.confirmPassword}
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(state.errors.confirmPassword)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </>
  )
}
