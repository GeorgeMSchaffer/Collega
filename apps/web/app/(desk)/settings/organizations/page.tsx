import { Button } from '@collega/design-system'
import Link from 'next/link'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { currentUser, organizations } from '@/lib/mock'

export const metadata = { title: 'Organizations · Collega' }

/**
 * Deployment configuration, so Site Admin only — an Org Admin passes the page-level administrator
 * gate but still may not see this, which is why the check is here rather than in `AdminOnly`.
 */
export default function OrganizationsPage() {
  if (currentUser.role !== 'SiteAdmin') {
    return (
      <SettingsPage
        title="Organizations"
        gate="organizations"
        lead="Deployment configuration, not this organization's. Only a Site Admin administers the list of organizations."
      >
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8">
          <h3 className="m-0 text-base font-semibold">Site Admin only</h3>
          <p className="m-0 max-w-prose text-sm text-muted-foreground">
            You administer {currentUser.organizationName}, not the deployment. Creating and retiring
            organizations belongs to a Site Admin.
          </p>
          <Link href="/settings">
            <Button variant="outline">Back to Settings</Button>
          </Link>
        </div>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title="Organizations"
      gate="organizations"
      lead="Every organization on this deployment. Open one to change its boards, statuses, types and membership."
      actions={<Button>Add organization</Button>}
    >
      <AdminTable summary={`${organizations.length} organizations.`}>
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Name</Th>
            <Th>Description</Th>
            <Th className="w-28">Members</Th>
            <Th className="w-28">Boards</Th>
            <Th className="w-28">Ideas</Th>
            <Th className="w-24" />
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
                <Button variant="outline" size="sm">
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
