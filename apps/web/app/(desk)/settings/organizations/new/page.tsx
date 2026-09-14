import { CreateOrganizationForm } from '@/components/settings/create-organization-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'New organization · Collega' }

/**
 * The one write a Site Admin owns outright.
 *
 * `siteAdminOnly` rather than the usual administrators gate, matching the list this is reached
 * from: rule 26's bootstrap exemption is specifically organization and user administration, and
 * creating a tenant is the write without which a fresh deployment can do nothing at all — the only
 * account that exists belongs to no organization.
 */
export default async function NewOrganizationPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  return (
    <SettingsPage
      title="New organization"
      gate="organizations"
      siteAdminOnly
      lead="Name the tenant and say what it is for. Its first board and default statuses are created with it."
    >
      <CreateOrganizationForm />
    </SettingsPage>
  )
}
