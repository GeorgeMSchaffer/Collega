import { Avatar, Badge, Button, Denied } from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { currentUser, members, organizations } from '@/lib/mock'

export const metadata = { title: 'Users · Collega' }

export default function UsersPage() {
  const siteAdmin = currentUser.role === 'SiteAdmin'

  return (
    <SettingsPage
      title={siteAdmin ? 'All users' : 'Users'}
      gate="users"
      lead={
        siteAdmin
          ? 'Every account on the deployment. Open an organization to change its membership.'
          : `Who is in ${currentUser.organizationName}, and what each of them may do.`
      }
      actions={
        siteAdmin ? (
          <Denied reason="Act as a member" id="why-invite">
            <Button aria-disabled="true" aria-describedby="why-invite">
              Invite user
            </Button>
          </Denied>
        ) : (
          <Button>Invite user</Button>
        )
      }
    >
      <AdminTable
        summary={
          siteAdmin
            ? `${members.length} accounts across ${organizations.length} organizations.`
            : `${members.length} members — one per role.`
        }
      >
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Name</Th>
            <Th>Email</Th>
            <Th className="w-32">Role</Th>
            <Th className="w-24">Status</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <Avatar initials={member.initials} className="size-6 text-[10px]" />
                  <b className="font-medium">{member.displayName}</b>
                </span>
              </td>
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
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </SettingsPage>
  )
}
