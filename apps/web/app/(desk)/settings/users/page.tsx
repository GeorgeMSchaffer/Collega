import { Avatar, Badge, Button, buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { InviteCodeCard } from '@/components/settings/invite-code'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import {
  getInviteCode,
  getMembers,
  getMembersForOrganization,
  getOrganizations,
  type Member,
  type Organization,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Users · Collega' }

/**
 * The cross-organization empty state offers navigation, not creation: an account belongs to one
 * organization, so there is no organization in scope here to add a person to.
 */
function NoUsers({ siteAdmin }: { siteAdmin: boolean }) {
  if (siteAdmin) {
    return (
      <EmptyState
        heading="No users anywhere yet"
        action={
          <Link href="/settings/organizations" className={buttonVariants({ variant: 'outline' })}>
            Go to Organizations
          </Link>
        }
      >
        No organization has configured users. Open an organization to set its users up &mdash; they
        cannot be created from this cross-organization view.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      heading="No users yet"
      action={<GatedAction id="why-add-first-user" label="Add the first user" denial={null} />}
    >
      You are the only account in this organization. Add people directly, or share the invite code
      above so they can register themselves.
    </EmptyState>
  )
}

export default async function UsersPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  const user = await requireCurrentUser()
  const siteAdmin = user.role === 'SiteAdmin'

  let rows: Member[] = []
  let organizations: Organization[] = []
  let inviteCode: string | null = null

  // Nothing is read for a role that may not read it. `AdminOnly` below already refuses a member,
  // and so does the API — but a reader runs before the gate renders, so calling anyway would land
  // that 403 on the error boundary in place of the refusal panel comp P specifies for this route.
  if (siteAdmin) {
    ;[rows, organizations] = await Promise.all([getMembers(), getOrganizations()])
  } else if (user.role === 'OrgAdmin' && user.organizationId !== null) {
    ;[rows, inviteCode] = await Promise.all([
      getMembersForOrganization(user.organizationId),
      getInviteCode(),
    ])
  }

  return (
    <SettingsPage
      title={siteAdmin ? 'All users' : 'Users'}
      gate="users"
      lead={
        siteAdmin
          ? // Comp P's own words, and load-bearing now that the rows are real: this list is
            // assembled per organization, so an account belonging to none — a Site Admin's own —
            // appears on it nowhere. "Every account on the deployment" would be a promise the
            // available endpoints cannot keep.
            'Every account across every organization. Open an organization to change its membership.'
          : `Who is in ${currentUser().organizationName}, and what each of them may do.`
      }
      actions={
        <span className="flex items-center gap-2">
          <Link href="/settings/users/import" className={buttonVariants({ variant: 'outline' })}>
            Import users
          </Link>
          {/* Bootstrap exception: user import stays direct for a Site Admin, but inviting one
              member into an organization they do not belong to has no referent. */}
          {siteAdmin ? null : <Button>Invite user</Button>}
        </span>
      }
    >
      {siteAdmin ? <CrossOrgNote what="An account" /> : null}

      {/* Comp P puts this above the table on the Org Admin's own screen, and the empty state below
          points at it by name. A Site Admin has no organization and so no code of their own. */}
      {inviteCode !== null && user.organizationId !== null ? (
        <InviteCodeCard organizationId={user.organizationId} inviteCode={inviteCode} />
      ) : null}

      {rows.length === 0 ? (
        <NoUsers siteAdmin={siteAdmin} />
      ) : (
        <AdminTable
          summary={
            siteAdmin
              ? `${rows.length} accounts across ${organizations.length} organizations.`
              : `${rows.length} members.`
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
      )}
    </SettingsPage>
  )
}
