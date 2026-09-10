'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import { useActionState } from 'react'
import { type LoginState, signIn } from '@/lib/server/auth-actions'

/**
 * Sign in (comp Q `s-login`).
 *
 * Three accessibility properties are carried over from comp D deliberately and must survive any
 * rework: a native `<button type="submit">` so Enter submits, `autocomplete="username"` paired with
 * the password field so password managers work, and a real `<label for>` bound to a real input.
 *
 * A client component only because it needs `useActionState` for the pending flag and the error —
 * the credential still never reaches client state, because the form posts a `FormData` straight to
 * the Server Function and neither field is a controlled input.
 *
 * The failure message lives beside the form rather than in a query string. The screen used to read
 * `?error=`, which a bookmark or a shared link could reproduce out of nowhere, and which meant a
 * failed sign-in was a navigation.
 *
 * The notices are the exception, and neither is a failure. `expired` means `proxy.ts` sent the
 * reader here after dropping a session the API refused; `registered` means they have just created an
 * account, which per comp P's `s-register` ends here rather than signed in. Without a word for
 * either, the form looks like it appeared for no reason. Both give way to a real sign-in failure
 * rather than stacking with one — by then the reader is being told about the attempt they just
 * made, not how they arrived.
 *
 * They are `role="status"` and not the default `role="alert"`, which is comp P's rule for all three
 * of its notice strings and not a detail: an alert interrupts a screen reader mid-sentence, and
 * nothing here went wrong.
 */
export function LoginForm({
  expired = false,
  registered = false,
}: {
  expired?: boolean
  registered?: boolean
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, {
    error: null,
    email: '',
  })

  return (
    <>
      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>
            <b>{state.error}</b> Five failed attempts within 15 minutes lock the account for 15
            minutes.
          </span>
        </Alert>
      ) : null}

      {registered && !state.error ? (
        <Alert variant="note" role="status" className="mb-4">
          <span>Your account was created. Sign in to get started.</span>
        </Alert>
      ) : null}

      {expired && !state.error ? (
        <Alert variant="note" role="status" className="mb-4">
          <span>Your session has ended. Sign in again to pick up where you left off.</span>
        </Alert>
      ) : null}

      <form action={formAction}>
        <Field htmlFor="email" label="Email">
          <Input
            id="email"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="you@yourcompany.com"
            // React resets the form once the action resolves, back to these defaults — so echoing
            // the submitted address here is what keeps a failed attempt from clearing it. The
            // password field has no such default, and is cleared on purpose.
            defaultValue={state.email}
          />
        </Field>
        <Field htmlFor="password" label="Password">
          <Input id="password" name="password" type="password" autoComplete="current-password" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </>
  )
}
