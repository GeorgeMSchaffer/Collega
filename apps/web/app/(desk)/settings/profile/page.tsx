import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FileButton,
} from '@collega/design-system'
import Link from 'next/link'
import { Topbar } from '@/components/nav/topbar'
import { PasswordForm } from '@/components/settings/password-form'
import { ProfileForm } from '@/components/settings/profile-form'
import { getProfile } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Profile · Collega' }

/**
 * The signed-in account's own settings.
 *
 * Deliberately **not** wrapped in `SettingsPage`, which gates every route it frames to an
 * administrator. This is the one settings surface comp Q gives all four roles — it is the reason the
 * hub stays ungated — so gating it would strand a member with no route to their own account.
 *
 * **The Portrait card is still inert.** Everything else on this screen writes. `PUT /auth/me/portrait`
 * has no section in `SPEC/30-Contracts.md` at all, `Avatar` renders initials and has no image
 * variant to show an uploaded portrait in, and the endpoint 500s rather than refusing anything a
 * camera produces — `apps/api` sets no body limit, so Express's 100kb default caps the Base64 at
 * roughly a 74kB file and overflows as an unhandled `PayloadTooLargeError`. Wiring a picker on top
 * of that would ship a control that fails on most real photographs with no message to render.
 */
export default async function ProfilePage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const profile = await getProfile()

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/settings">Settings</Link> /{' '}
            <b className="font-medium text-foreground">Profile</b>
          </span>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-6 p-6">
        <div>
          <h1>My Profile</h1>
          <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
            Edit your name and change your password. Email and role are read-only.
          </p>
        </div>

        <div className="flex max-w-[720px] flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Portrait</CardTitle>
              <CardDescription>
                Upload a GIF, JPEG, or PNG. It is resized to a small thumbnail and shown in place of
                your initials throughout Collega.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <Avatar initials={currentUser().initials} className="size-14 text-base" />
              <FileButton
                id="portrait"
                name="portrait"
                label="Choose image…"
                accept="image/gif,image/jpeg,image/png"
              />
              <Button variant="outline">Remove portrait</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
              <CardDescription>Your name appears throughout Collega.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                firstName={profile.firstName}
                lastName={profile.lastName}
                email={profile.email}
                roleLabel={currentUser().roleLabel}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                After changing your password, sign in again with the new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
