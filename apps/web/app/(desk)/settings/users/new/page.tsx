import { CreateUserForm } from '@/components/settings/create-user-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getOrganizations } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'New user · Collega' }

/**
 * Adding a person to an organization.
 *
 * **A Site Admin picks the organization; they are not turned away.** This page refused them until
 * 2026-09-14, on the reasoning that a Site Admin belongs to no organization and so has none to add
 * to — and sent them to View As, which has no implementation at all. Both halves were wrong.
 * `UserService.authorizeOrganizationScope` returns immediately for a Site Admin: user administration
 * is rule 26's bootstrap exemption, and refusing here blocked the one path that makes a fresh
 * deployment usable.
 *
 * So the organization is a field rather than an assumption. An Org Admin never sees it — theirs is
 * the only one they may write to, and asking would be a question the session has already answered.
 */
export default async function NewUserPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const siteAdmin = currentUser().role === 'SiteAdmin'

  // Only a Site Admin needs the list, and only a Site Admin may read it.
  const organizations = siteAdmin ? await getOrganizations() : []
  const organizationId = siteAdmin ? null : currentUser().organizationId

  return (
    <SettingsPage
      title="New user"
      gate="people"
      lead="They will be asked to change the password you set the first time they sign in."
    >
      <CreateUserForm
        organizationId={organizationId}
        organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
      />
    </SettingsPage>
  )
}
