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
 */
export function LoginForm() {
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
