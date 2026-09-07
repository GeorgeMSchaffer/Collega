import { Button } from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { organizations } from '@/lib/mock'

export const metadata = { title: 'Organizations · Collega' }

/**
 * Deployment configuration, so Site Admin only. An Org Admin passes the administrator gate and is
 * still refused here, which is why the route declares `siteAdminOnly` rather than relying on
 * `AdminOnly` — the member wording ("an administrator's job") would be false to an Org Admin's face.
 */
export default function OrganizationsPage() {
  return (
    <SettingsPage
      title="Organizations"
      gate="organizations"
      siteAdminOnly
      lead="Every organization on this deployment. Open one to change its boards, statuses, types and membership."
      actions={<Button>Add organization</Button>}
    >
      <AdminTable summary={`${organizations.length} organizations.`}>
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Organization</Th>
            <Th>Description</Th>
            <Th className="w-28">Members</Th>
            <Th className="w-28">Boards</Th>
            <Th className="w-28">Ideas</Th>
            <Th className="w-24">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => (
            <tr key={org.id} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{org.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{org.description}</td>
              <td className="px-4 py-2.5 tabular-nums">{org.memberCount}</td>
              <td className="px-4 py-2.5 tabular-nums">{org.boardCount}</td>
              <td className="px-4 py-2.5 tabular-nums">{org.ideaCount}</td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="outline" size="sm" aria-label={`Manage ${org.name}`}>
                  Manage
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </SettingsPage>
  )
}
