'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import { useActionState } from 'react'
import { changePassword, type PasswordState } from '@/lib/server/auth-actions'

/** For the reason `register-form.tsx` gives: a `'use server'` module exports only async functions. */
const NOTHING_SUBMITTED: PasswordState = { error: null, errors: {} }

/**
 * The voluntary password change (comp P `s-profile`, "Change password").
 *
 * The same Server Function as the forced rotation and a different screen, which is comp P's own
 * split: *"The voluntary change lives under Settings › Profile and is a different screen."* Only
 * the layout differs — comp P narrows the current-password field and pairs the other two in a grid
 * — so the two forms are two pieces of markup over one action rather than one component with a
 * flag, which would be a prop for every difference and no shared behaviour to justify it.
 *
 * The hint states the real policy rather than comp P's *"At least 12 characters."* — `PASSWORD_MIN_LENGTH`
 * is 6 and `validatePassword` also requires four character classes, so comp P's sentence both
 * overstates the length and omits every other rule. Comp P's own first-sign-in screen states the
 * policy correctly, and so does the register form; this was the one copy that disagreed.
 */
export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    NOTHING_SUBMITTED,
  )

  return (
    <form action={formAction}>
      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>{state.error}</span>
        </Alert>
      ) : null}

      <Field
        htmlFor="currentPassword"
        label="Current password"
        error={state.errors.currentPassword}
        className="max-w-[340px]"
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(state.errors.currentPassword)}
        />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
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
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  )
}
