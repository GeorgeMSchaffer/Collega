import { Button, buttonVariants, Dot, EmptyState, Marker } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { StatusForm } from '@/components/settings/status-form'
import { getStatuses, getStatusesByOrganization } from '@/lib/data'
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
        <GatedAction id="why-add-first-status" label="Add the first status" denial={null}>
          <a href="#add-status" className={buttonVariants()}>
            Add the first status
          </a>
        </GatedAction>
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

  const siteAdmin = currentUser().role === 'SiteAdmin'

  // Two genuinely different reads, not one filtered two ways: a Site Admin belongs to no
  // organization and reads every organization's catalog in turn, while everyone else reads the one
  // they are in. Asking for both would issue a fan-out nobody renders.
  const catalogs = siteAdmin
    ? await getStatusesByOrganization()
    : [{ organization: currentUser().organizationName ?? '', statuses: await getStatuses() }]

  const rows = catalogs.flatMap((catalog) =>
    catalog.statuses.map((status) => ({ status, org: catalog.organization })),
  )

  return (
    <SettingsPage
      title={siteAdmin ? 'All statuses' : 'Statuses'}
      gate="statuses"
      lead={
        siteAdmin
          ? 'Workflow statuses across every organization. Open an organization to change its statuses.'
          : 'The columns your boards group ideas by. Order here is the order on every board.'
      }
      // An anchor rather than a button: the create form is a card on this page (comp P puts it
      // beside the list rather than in a drawer), so the topbar action's job is to reach it.
      actions={
        siteAdmin ? undefined : (
          <a href="#add-status" className={buttonVariants()}>
            Add status
          </a>
        )
      }
    >
      {siteAdmin ? <CrossOrgNote what="A status" /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <NoStatuses siteAdmin={siteAdmin} />
          ) : (
            <AdminTable
              summary={
                siteAdmin
                  ? `${rows.length} statuses across ${catalogs.length} organizations.`
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
                    {siteAdmin ? (
                      <td className="px-4 py-2.5 text-muted-foreground">{org}</td>
                    ) : null}
                    <td className="px-4 py-2.5">
                      <Marker>
                        <Dot color={status.color} />
                        {/* The hex itself, because a real status carries no colour name and one
                            invented from `#64748B` would be a lookup table nobody maintains. */}
                        {status.colorName ?? status.color}
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
        </div>

        {/* No create column for a Site Admin: the API refuses that role every organization-content
            mutation (`ensureNotDirectSiteAdmin`), so a form here could only ever be refused. */}
        {siteAdmin ? null : <StatusForm />}
      </div>
    </SettingsPage>
  )
}
