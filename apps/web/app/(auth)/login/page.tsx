import { Alert, Button, Field, Input, Kbd } from '@collega/design-system'
import Link from 'next/link'
import { AuthPitch } from '@/components/auth-pitch'

export const metadata = { title: 'Sign in · Collega' }

/**
 * Sign in (comp Q `s-login`).
 *
 * Three accessibility properties are carried over from comp D deliberately and must survive any
 * rework: a native `<button type="submit">` so Enter submits, `autocomplete="username"` paired with
 * the password field so password managers work, and a real `<label for>` bound to a real input.
 *
 * No submit handler yet — Wave D owns the endpoint. The form posts nowhere rather than pretending.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <>
      <AuthPitch
        heading="Every idea your organization has, in one place."
        points={[
          'One account per person, scoped to your organization',
          'Boards, statuses and idea types you define yourself',
          <>
            Keyboard-first: press{' '}
            <Kbd className="border-white/30 bg-white/15 text-white">Ctrl K</Kbd> anywhere
          </>,
        ]}
      >
        <p>
          Collega tracks an idea from the first rough note through review, work, and delivery — with
          the people, comments, and history attached to it the whole way.
        </p>
      </AuthPitch>

      <div className="flex flex-col justify-center bg-background px-6 py-16 sm:px-14">
        <div className="mx-auto w-full max-w-[356px]">
          <h1>Sign in</h1>
          <p className="mt-1 mb-5 text-base text-muted-foreground">
            One email, one account. We&rsquo;ll take you straight to your organization.
          </p>

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <span>
                <b>Incorrect email or password.</b> Five failed attempts within 15 minutes lock the
                account for 15 minutes.
              </span>
            </Alert>
          ) : null}

          <form>
            <Field htmlFor="email" label="Email">
              <Input
                id="email"
                name="email"
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="you@yourcompany.com"
              />
            </Field>
            <Field htmlFor="password" label="Password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Have an invite code? <Link href="/login">Create an account</Link>.
            <br />
            Forgot your password? Ask your organization admin to reset it.
          </p>

          <Alert variant="note" className="mt-4">
            <span>
              <b>Not wired up yet.</b> Sign-in needs{' '}
              <code className="font-mono text-xs">POST /auth/login</code>, which arrives with Wave
              D. Until then this is the comp Q rendering with no submit handler — see{' '}
              <code className="font-mono text-xs">demo.md</code> for accounts that work against the
              .NET app.
            </span>
          </Alert>
        </div>
      </div>
    </>
  )
}
