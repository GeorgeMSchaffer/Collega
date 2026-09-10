import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FileButton,
  Input,
} from '@collega/design-system'
import Link from 'next/link'
import { InertForm } from '@/components/common/inert-form'
import { Topbar } from '@/components/nav/topbar'
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
 */
export default async function ProfilePage() {
  // Identity first, and in this segment: Next renders a layout and its page independently,
  // so the desk layout resolving it is not enough for what renders here. One `/auth/me` per
  // request all the same — the resolver is request-cached.
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
              <InertForm>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field htmlFor="firstName" label="First name">
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      defaultValue={profile.firstName}
                    />
                  </Field>
                  <Field htmlFor="lastName" label="Last name">
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      defaultValue={profile.lastName}
                    />
                  </Field>
                </div>
                <Field
                  htmlFor="email"
                  label="Email"
                  hint="Email is your sign-in identity and cannot be changed here."
                >
                  <Input
                    id="email"
                    name="email"
                    type="text"
                    readOnly
                    defaultValue={profile.email}
                  />
                </Field>
                <Field htmlFor="role" label="Role" hint="Your role is set by an administrator.">
                  <Input
                    id="role"
                    name="role"
                    type="text"
                    readOnly
                    defaultValue={currentUser().roleLabel}
                  />
                </Field>
                <Button type="submit">Save profile</Button>
              </InertForm>
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
              <InertForm>
                <Field htmlFor="currentPassword" label="Current password">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                  />
                </Field>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field htmlFor="newPassword" label="New password" hint="At least 12 characters.">
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field htmlFor="confirmPassword" label="Confirm new password">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                <Button type="submit">Change password</Button>
              </InertForm>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
