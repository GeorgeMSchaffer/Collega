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
 * The notices are the exception, and none is a failure. Comp Q's `s-returned` gives the screen
 * three and says why they exist: *"Every route back to this page carries its reason: an expired
 * session, a changed password, or a freshly created account. A deliberate sign-out carries none."*
 * `expired` means `proxy.ts` sent the reader here after dropping a session the API refused;
 * `registered` means they have just created an account, which per comp P's `s-register` ends here
 * rather than signed in; `passwordChanged` means the change invalidated the session it was made
 * with, which is what `changePassword` explains. Without a word for any of them, the form looks
 * like it appeared for no reason. All give way to a real sign-in failure rather than stacking with
 * one — by then the reader is being told about the attempt they just made, not how they arrived.
 *
 * They are `role="status"` and not the default `role="alert"`, which is comp P's rule for all three
 * of its notice strings and not a detail: an alert interrupts a screen reader mid-sentence, and
 * nothing here went wrong.
 */
export function LoginForm({
  expired = false,
  registered = false,
  passwordChanged = false,
}: {
  expired?: boolean
  registered?: boolean
  passwordChanged?: boolean
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, {
    error: null,
    rateLimited: false,
    email: '',
  })

  return (
    <>
      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>
            <b>{state.error}</b>
            {/* The lockout rule belongs beside a refusal of the credential, and nowhere else. A
                request the rate limiter turned away never reached the account, so pairing it with
                "five failed attempts" tells the reader they got their password wrong — which is
                the mistake this sentence is here to prevent, not cause. */}
            {state.rateLimited
              ? null
              : ' Five failed attempts within 15 minutes lock the account for 15 minutes.'}
          </span>
        </Alert>
      ) : null}

      {registered && !state.error ? (
        <Alert variant="note" role="status" className="mb-4">
          <span>Your account was created. Sign in to get started.</span>
        </Alert>
      ) : null}

      {passwordChanged && !state.error ? (
        <Alert variant="note" role="status" className="mb-4">
          <span>Your password was changed. Please sign in with your new password.</span>
        </Alert>
      ) : null}

      {/* Last of the three, and the only one that can arrive alongside another: a rotation drops
          the cookie, so `proxy.ts` has nothing to call expired — but a reader who leaves this page
          open and comes back through a stale link can carry both flags. The password is the newer
          fact and the one they need in hand, so it is the one that shows. */}
      {expired && !state.error && !passwordChanged ? (
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
