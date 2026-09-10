'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import { useActionState } from 'react'
import { type RegisterState, register } from '@/lib/server/auth-actions'

/**
 * Lives here and not beside the action, even though that is where it belongs conceptually.
 *
 * A `'use server'` module may only export async functions — every other export is replaced by a
 * reference the client cannot resolve, so a constant imported from there arrives as `undefined` and
 * the first `state.errors` lookup throws during prerender. `tsc` sees a perfectly good import and
 * says nothing; only `next build` catches it, which is why it is in `pnpm check`.
 */
const NOTHING_SUBMITTED: RegisterState = {
  error: null,
  errors: {},
  values: { inviteCode: '', firstName: '', lastName: '', email: '' },
}

/**
 * Create an account from an invite code (comp Q `s-register`).
 *
 * Carries the same three accessibility properties as the sign-in form, for the same reasons: a
 * native `<button type="submit">` so Enter submits, real `<label for>` bindings, and autocomplete
 * tokens a password manager understands — `username` beside `new-password` so it offers to generate
 * and store one, rather than `current-password`, which would offer to fill an account that does not
 * exist yet.
 *
 * A client component only because it needs `useActionState` for the pending flag and the errors.
 * The password never reaches client state: both fields post as `FormData` to the Server Function and
 * neither is a controlled input.
 *
 * The invite code is deliberately not carried in the URL — see `app/(auth)/register/page.tsx`.
 */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    register,
    NOTHING_SUBMITTED,
  )

  return (
    <>
      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>
            <b>Registration failed.</b> {state.error}
          </span>
        </Alert>
      ) : null}

      <form action={formAction}>
        <Field htmlFor="inviteCode" label="Invite code" error={state.errors.inviteCode}>
          <Input
            id="inviteCode"
            name="inviteCode"
            // `off` and not a password-manager token: the code is an organization's shared secret,
            // not this person's credential, and browsers offering it back on a public machine is
            // how one leaks. Monospace for the same reason comp P sets it — it is read off a
            // message and retyped, where O/0 and I/l have to be told apart.
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-wider"
            placeholder="ACME-ROBOTICS-1A2B3C4D"
            defaultValue={state.values.inviteCode}
            invalid={Boolean(state.errors.inviteCode)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field htmlFor="firstName" label="First name" error={state.errors.firstName}>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              defaultValue={state.values.firstName}
              invalid={Boolean(state.errors.firstName)}
            />
          </Field>
          <Field htmlFor="lastName" label="Last name" error={state.errors.lastName}>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              defaultValue={state.values.lastName}
              invalid={Boolean(state.errors.lastName)}
            />
          </Field>
        </div>

        <Field htmlFor="email" label="Email" error={state.errors.email}>
          <Input
            id="email"
            name="email"
            // `type="text"`, matching sign-in: the API owns the address rule, and the browser's own
            // `type="email"` check would refuse the submit before the field-level message that
            // explains the problem could ever be rendered.
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="you@yourcompany.com"
            defaultValue={state.values.email}
            invalid={Boolean(state.errors.email)}
          />
        </Field>

        <Field
          htmlFor="password"
          label="Password"
          error={state.errors.password}
          // Given up as the hint only while nothing is wrong: once the API has said which rule was
          // broken, that sentence is the more useful of the two and `Field` shows one at a time.
          hint="At least 6 characters, with an uppercase letter, a lowercase letter, a number and a symbol."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(state.errors.password)}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </>
  )
}
