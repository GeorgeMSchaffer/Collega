import { Button, Dot, Marker } from '@collega/design-system'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { currentUser, organizations, statuses, statusesByOrganization } from '@/lib/mock'

export const metadata = { title: 'Statuses · Collega' }

export default function StatusesPage() {
  const siteAdmin = currentUser.role === 'SiteAdmin'

  // A status belongs to exactly one organization, so the cross-org list is a union of distinct
  // rows. Repeating one organization's statuses per organization would assert the opposite of the
  // rule this screen exists to teach.
  const rows = siteAdmin
    ? organizations.flatMap((org) =>
        (statusesByOrganization[org.id] ?? []).map((status) => ({ status, org: org.name })),
      )
    : statuses.map((status) => ({ status, org: currentUser.organizationName ?? '' }))

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
    </SettingsPage>
  )
}
