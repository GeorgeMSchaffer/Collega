import { Badge, Button, CodeChip, EmptyState } from '@collega/design-system'
import { GatedAction } from '@/components/common/gated-action'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { getOrganizations } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Organizations · Collega' }

/**
 * Deployment configuration, so Site Admin only. An Org Admin passes the administrator gate and is
 * still refused here, which is why the route declares `siteAdminOnly` rather than relying on
 * `AdminOnly` — the member wording ("an administrator's job") would be false to an Org Admin's face.
 *
 * The columns are comp P's: organization, location, invite code, status. They are not the ones the
 * fixture drew — member, board and idea counts — because `GET /organizations` returns no counts and
 * comp P's table never showed any. The fixture promised three columns the endpoint cannot fill.
 *
 * **The invite code is rendered here, in the body of the page, and must stay there.** It is a
 * standing credential that self-registers anyone into the organization it names, so it must not
 * reach a URL, a query string or a link — the reasoning `app/(auth)/register/page.tsx` sets out for
 * the other end of the same value. A Site Admin reading this page is exactly who needs to be able
 * to read one out and hand it over.
 *
 * `getOrganizations` answers empty for any other role rather than calling and being refused, so
 * this page reaches the refusal panel below rather than an error boundary.
 */
export default async function OrganizationsPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const organizations = await getOrganizations()

  return (
    <SettingsPage
      title="Organizations"
      gate="organizations"
      siteAdminOnly
      lead="Every organization on this deployment. Open one to change its boards, statuses, types and membership."
      actions={<Button>Add organization</Button>}
    >
      {organizations.length === 0 ? (
        <EmptyState
          heading="No organizations yet"
          // The bootstrap exception: creating the first tenant is the one write a Site Admin owns,
          // so this action is live rather than gated.
          action={
            <GatedAction
              id="why-create-first-organization"
              label="Create the first organization"
              denial={null}
            />
          }
        >
          Collega has no tenants. Creating the first one is the only thing that can happen on this
          deployment until it exists.
        </EmptyState>
      ) : (
        <AdminTable
          summary={`${organizations.length} organizations. Archived ones are hidden unless filtered in.`}
        >
          <thead>
            <tr className="border-b bg-muted/40">
              <Th>Organization</Th>
              <Th className="w-40">Location</Th>
              <Th className="w-44">Invite code</Th>
              <Th className="w-28">Status</Th>
              <Th className="w-24">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <b className="font-medium">{org.name}</b>
                  <div className="text-xs text-muted-foreground">{org.description}</div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{org.location ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <CodeChip>{org.inviteCode}</CodeChip>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={org.isArchived ? 'outline' : 'success'}>
                    {org.isArchived ? 'Archived' : 'Active'}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="outline" size="sm" aria-label={`Manage ${org.name}`}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
    </SettingsPage>
  )
}
