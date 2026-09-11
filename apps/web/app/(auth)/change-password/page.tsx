import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { AuthPitch } from '@/components/auth-pitch'

export const metadata = { title: 'Change your password · Collega' }

/**
 * Forced first-sign-in password change (comp Q `s-first-signin`).
 *
 * The pitch copy states the rule that makes this screen non-optional: until the temporary password
 * is replaced the server refuses every other request, so this is a gate rather than a prompt. The
 * API enforces exactly that — only `GET /auth/me` and this change carry
 * `@AllowWhilePasswordChangeRequired()` — which is also why comp P gives the screen no sidebar: a
 * navigation rail here would be a rail of dead ends.
 *
 * No `searchParams`. The mismatch used to arrive as `?error=mismatch`, which a bookmark or a shared
 * link could reproduce out of nowhere, and which made a refused submission a navigation; the form
 * holds its own refusals now. That leaves nothing per-request to read, so this prerenders.
 */
export default function ChangePasswordPage() {
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

          <ChangePasswordForm />

          <p className="mt-4 text-sm text-muted-foreground">
            Saving signs you out. Sign in again with the new password and you will land on Home.
          </p>
        </div>
      </div>
    </>
  )
}
