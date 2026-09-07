import { Avatar, Badge, Button } from '@collega/design-system'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { currentUser, members, membersForOrganization, organizations } from '@/lib/mock'

export const metadata = { title: 'Users · Collega' }

export default function UsersPage() {
  const siteAdmin = currentUser.role === 'SiteAdmin'
  const rows = siteAdmin ? members : membersForOrganization('acme-robotics')

  return (
    <SettingsPage
      title={siteAdmin ? 'All users' : 'Users'}
      gate="users"
      lead={
        siteAdmin
          ? 'Every account on the deployment. Open an organization to change its membership.'
          : `Who is in ${currentUser.organizationName}, and what each of them may do.`
      }
      actions={siteAdmin ? undefined : <Button>Invite user</Button>}
    >
      {siteAdmin ? <CrossOrgNote what="An account" /> : null}
      <AdminTable
        summary={
          siteAdmin
            ? `${rows.length} accounts across ${organizations.length} organizations.`
            : `${rows.length} members — one per role.`
        }
      >
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Name</Th>
            {siteAdmin ? <Th className="w-56">Organization</Th> : null}
            <Th>Email</Th>
            <Th className="w-32">Role</Th>
            <Th className="w-24">Status</Th>
            <Th className="w-24">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr key={member.id} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <Avatar initials={member.initials} className="size-6 text-[10px]" />
                  <b className="font-medium">{member.displayName}</b>
                </span>
              </td>
              {siteAdmin ? (
                <td className="px-4 py-2.5 text-muted-foreground">{member.organizationName}</td>
              ) : null}
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {member.email}
              </td>
              <td className="px-4 py-2.5">{member.roleLabel}</td>
              <td className="px-4 py-2.5">
                <Badge variant={member.status === 'Active' ? 'success' : 'outline'}>
                  {member.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${siteAdmin ? 'Manage' : 'Edit'} ${member.displayName}`}
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
