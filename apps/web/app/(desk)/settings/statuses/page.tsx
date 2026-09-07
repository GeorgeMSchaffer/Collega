import { Button, Denied, Dot, Marker } from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { currentUser, organizations, statuses } from '@/lib/mock'

export const metadata = { title: 'Statuses · Collega' }

export default function StatusesPage() {
  const siteAdmin = currentUser.role === 'SiteAdmin'

  // A Site Admin reads every organization's statuses; an Org Admin reads only their own.
  const rows = siteAdmin
    ? organizations.flatMap((org) => statuses.map((status) => ({ status, org: org.name })))
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
      actions={
        siteAdmin ? (
          <Denied reason="Act as a member" id="why-add-status">
            <Button aria-disabled="true" aria-describedby="why-add-status">
              Add status
            </Button>
          </Denied>
        ) : (
          <Button>Add status</Button>
        )
      }
    >
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
            <Th className="w-24" />
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
                  {status.color.replace('var(--', '').replace(')', '')}
                </Marker>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="outline" size="sm">
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
