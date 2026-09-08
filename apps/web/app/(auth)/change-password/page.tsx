import { Alert, Button, Field, Input } from '@collega/design-system'
import { AuthPitch } from '@/components/auth-pitch'
import { InertForm } from '@/components/common/inert-form'

export const metadata = { title: 'Change your password · Collega' }

/**
 * Forced first-sign-in password change (comp Q `s-first-signin`).
 *
 * The pitch copy states the rule that makes this screen non-optional: until the temporary password
 * is replaced the server refuses every other request, so this is a gate rather than a prompt.
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const mismatch = error === 'mismatch'

  return (
    <>
      <AuthPitch heading="Choose your own password.">
        <p>
          You signed in with a temporary password issued by an administrator. It works exactly once
          and expires 24 hours after it was issued. Until you replace it, nothing else in Collega
          will open — the server refuses every other request, not just this page.
        </p>
      </AuthPitch>

      <div className="flex flex-col justify-center bg-background px-6 py-16 sm:px-14">
        <div className="mx-auto w-full max-w-[356px]">
          <h1>Change your password</h1>
          <p className="mt-1 mb-5 text-base text-muted-foreground">
            For security, choose a new password before continuing.
          </p>

          {mismatch ? (
            <Alert variant="destructive" className="mb-4">
              <span>
                <b>The new password and confirmation don&rsquo;t match.</b> Nothing has been
                changed.
              </span>
            </Alert>
          ) : null}

          <InertForm>
            <Field
              htmlFor="currentPassword"
              label="Current password"
              hint="The temporary password you just signed in with."
            >
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
            </Field>
            <Field
              htmlFor="newPassword"
              label="New password"
              hint="At least 6 characters, with an uppercase letter, a lowercase letter, a number and a symbol."
            >
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
              />
            </Field>
            <Field
              htmlFor="confirmPassword"
              label="Confirm new password"
              {...(mismatch ? { error: 'Must match the new password exactly.' } : {})}
            >
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                invalid={mismatch}
              />
            </Field>
            <Button type="submit" className="w-full">
              Update password
            </Button>
          </InertForm>

          <p className="mt-4 text-sm text-muted-foreground">
            Saving signs you out. Sign in again with the new password and you will land on Home.
          </p>
        </div>
      </div>
    </>
  )
}
