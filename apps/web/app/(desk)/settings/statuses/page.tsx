import { Button, buttonVariants, Dot, EmptyState, Marker } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { getOrganizations, getStatuses, getStatusesByOrganization } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Statuses · Collega' }

/**
 * The cross-organization empty state offers navigation, not creation: a status belongs to exactly
 * one organization, so there is no organization in scope here for a create control to create one
 * in. The way forward is to open one, which is what the link does.
 */
function NoStatuses({ siteAdmin }: { siteAdmin: boolean }) {
  if (siteAdmin) {
    return (
      <EmptyState
        heading="No statuses anywhere yet"
        action={
          <Link href="/settings/organizations" className={buttonVariants({ variant: 'outline' })}>
            Go to Organizations
          </Link>
        }
      >
        No organization has configured statuses. Open an organization to set its statuses up &mdash;
        they cannot be created from this cross-organization view.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      heading="No statuses yet"
      action={
        <span className="flex flex-wrap items-center gap-2">
          <GatedAction id="why-add-first-status" label="Add the first status" denial={null} />
          <Button variant="outline">Use the five defaults</Button>
        </span>
      }
    >
      Statuses are the columns your boards group ideas by. Add the first one and every board in this
      organization gets that lane.
    </EmptyState>
  )
}

export default async function StatusesPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [organizations, statuses, statusesByOrganization] = await Promise.all([
    getOrganizations(),
    getStatuses(),
    getStatusesByOrganization(),
  ])
  const siteAdmin = currentUser().role === 'SiteAdmin'

  // A status belongs to exactly one organization, so the cross-org list is a union of distinct
  // rows. Repeating one organization's statuses per organization would assert the opposite of the
  // rule this screen exists to teach.
  const rows = siteAdmin
    ? organizations.flatMap((org) =>
        (statusesByOrganization[org.id] ?? []).map((status) => ({ status, org: org.name })),
      )
    : statuses.map((status) => ({ status, org: currentUser().organizationName ?? '' }))

  return (
    <SettingsPage
      title={siteAdmin ? 'All statuses' : 'Statuses'}
      gate="statuses"
      lead={
        siteAdmin
          ? 'Workflow statuses across every organization. Open an organization to change its statuses.'
          : 'The columns your boards group ideas by. Order here is the order on every board.'
      }
      actions={siteAdmin ? undefined : <Button>Add status</Button>}
    >
      {siteAdmin ? <CrossOrgNote what="A status" /> : null}
      {rows.length === 0 ? (
        <NoStatuses siteAdmin={siteAdmin} />
      ) : (
        <AdminTable
          summary={
            siteAdmin
              ? `${rows.length} statuses across ${organizations.length} organizations.`
              : `${rows.length} statuses, in board order.`
          }
        >
          <thead>
            <tr className="border-b bg-muted/40">
              <Th>Name</Th>
              {siteAdmin ? <Th className="w-56">Organization</Th> : null}
              <Th className="w-44">Colour</Th>
              <Th className="w-24">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ status, org }) => (
              <tr key={`${org}-${status.id}`} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{status.name}</td>
                {siteAdmin ? <td className="px-4 py-2.5 text-muted-foreground">{org}</td> : null}
                <td className="px-4 py-2.5">
                  <Marker>
                    <Dot color={status.color} />
                    {status.colorName}
                  </Marker>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${siteAdmin ? 'Manage' : 'Edit'} ${status.name}`}
                  >
                    {siteAdmin ? 'Manage' : 'Edit'}
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
