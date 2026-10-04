import {
  Alert,
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@collega/design-system'
import Link from 'next/link'
import { OrganizationEditForm } from '@/components/settings/organization-edit-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getOrgAdminsForOrganization, getOrganizationDetail } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import type { Member } from '@/lib/types'

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
  const [organization, admins] = await Promise.all([
    getOrganizationDetail(organizationId),
    getOrgAdminsForOrganization(organizationId),
  ])

  return (
    <SettingsPage
      title={`Edit ${organization.name}`}
      gate="organizations"
      siteAdminOnly
      lead="Everything recorded about this organization. Saving replaces the whole record, so the form shows all of it."
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <OrgAdmins organizationId={organizationId} admins={admins} />
        <OrganizationEditForm organization={organization} />
      </div>
    </SettingsPage>
  )
}

/**
 * Who you can act as here (`SPEC/decisions.md` 2026-10-04). Organization content is reached through
 * View As, which needs an active Org Admin to act as; an organization without one is a dead end, so
 * the page says so and offers the fix — Add New User, preset to this organization and the Org Admin
 * role. A deactivated admin is reactivated from their own user page.
 */
function OrgAdmins({ organizationId, admins }: { organizationId: string; admins: Member[] }) {
  const active = admins.filter((admin) => admin.status === 'Active')
  const add = `/settings/users/new?organization=${encodeURIComponent(organizationId)}&role=OrgAdmin`

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Org Admins</CardTitle>
        <Link href={add} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Add Org Admin
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {active.length === 0 ? (
          <Alert variant="destructive">
            This organization has no active Org Admin, so there is nobody to act as. Add one, or
            reactivate one below.
          </Alert>
        ) : null}
        {admins.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {admins.map((admin) => (
              <li key={admin.id} className="flex items-center gap-3 text-sm">
                <Link href={`/settings/users/${admin.id}`} className="font-medium">
                  {admin.displayName}
                </Link>
                <span className="text-muted-foreground">{admin.email}</span>
                {admin.status === 'Inactive' ? <Badge variant="outline">Inactive</Badge> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
