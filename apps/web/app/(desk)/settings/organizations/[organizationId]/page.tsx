import { OrganizationEditForm } from '@/components/settings/organization-edit-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getOrganizationDetail } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Edit organization · Collega' }

/**
 * Editing one organization — and the screen the create form has been pointing at all along.
 *
 * `siteAdminOnly`, matching the list it is reached from and for the same reason: rule 26's
 * bootstrap exemption names organization administration specifically, so this is one of the two
 * places that role writes rather than reads.
 *
 * Unlike the catalog edit pages, this reads its record from the API rather than finding it in a
 * list. `GET /organizations/{id}` exists, and it is the only read that carries the profile columns
 * the form has to post back — the cross-organization list carries a composed `location` cell and
 * nothing else.
 */
export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { organizationId } = await params
  const organization = await getOrganizationDetail(organizationId)

  return (
    <SettingsPage
      title={`Edit ${organization.name}`}
      gate="organizations"
      siteAdminOnly
      lead="Everything recorded about this organization. Saving replaces the whole record, so the form shows all of it."
    >
      <div className="max-w-2xl">
        <OrganizationEditForm organization={organization} />
      </div>
    </SettingsPage>
  )
}
