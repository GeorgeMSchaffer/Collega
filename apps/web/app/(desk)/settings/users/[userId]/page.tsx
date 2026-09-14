import Link from 'next/link'
import { Topbar } from '@/components/nav/topbar'
import { RefusalPanel } from '@/components/settings/admin-only'
import { SettingsPage } from '@/components/settings/settings-page'
import { UserEditForm } from '@/components/settings/user-edit-form'
import { getMemberDetail } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Edit user · Collega' }

/**
 * Editing one account.
 *
 * **A Site Admin's own row gets a refusal rather than a form**, and that is a real constraint
 * rather than caution: `PUT /users/{id}` requires a role, `parseAssignableRole` refuses
 * `SiteAdmin`, so every possible submission for such a row is a 400. A form that cannot be saved
 * under any input is worse than a sentence saying so.
 *
 * Everyone else is the API's business. `UserService` decides who may write whom — an Org Admin
 * within their own organization, a Site Admin under rule 26's bootstrap exemption — and a check
 * here could only ever disagree with the one that counts.
 */
export default async function EditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { userId } = await params
  const member = await getMemberDetail(userId)

  if (member.role === 'SiteAdmin') {
    // `RefusalPanel` renders its own heading, so this deliberately does not wrap it in
    // `SettingsPage` — that would put two level-1 headings on the page, which is a defect already
    // recorded against the board screen rather than one to repeat here. Same shape as
    // `BoardRefusal`, for the same reason.
    return (
      <>
        <Topbar
          title={
            <span className="text-sm font-normal text-muted-foreground">
              <Link href="/settings/users">People</Link> /{' '}
              <b className="font-medium text-foreground">
                {member.firstName} {member.lastName}
              </b>
            </span>
          }
        />
        <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
          <RefusalPanel heading="A Site Admin account cannot be edited here">
            Saving requires a role, and <code>SiteAdmin</code> is not one this route accepts — a
            platform account belongs to no organization, so it cannot be assigned to one by anybody.
            Their name and email are theirs to change on their own profile.
          </RefusalPanel>
        </main>
      </>
    )
  }

  return (
    <SettingsPage
      title={`Edit ${member.firstName} ${member.lastName}`}
      gate="users"
      lead="Name, sign-in address, role and whether the account may sign in at all."
    >
      <div className="max-w-2xl">
        <UserEditForm member={member} />
      </div>
    </SettingsPage>
  )
}
