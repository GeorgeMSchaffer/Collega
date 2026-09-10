import { Button, buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { getIdeaTypes, getOrganizations } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Idea types · Collega' }

/**
 * The cross-organization empty state offers navigation, not creation: an idea type belongs to one
 * organization, so there is nothing here for a create control to create.
 */
function NoIdeaTypes({ siteAdmin }: { siteAdmin: boolean }) {
  if (siteAdmin) {
    return (
      <EmptyState
        heading="No idea types anywhere yet"
        action={
          <Link href="/settings/organizations" className={buttonVariants({ variant: 'outline' })}>
            Go to Organizations
          </Link>
        }
      >
        No organization has configured idea types. Open an organization to set its idea types up
        &mdash; they cannot be created from this cross-organization view.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      heading="No idea types yet"
      action={
        <GatedAction id="why-add-first-idea-type" label="Add the first idea type" denial={null} />
      }
    >
      Every idea is exactly one type, chosen at creation, so ideas cannot be created until at least
      one type exists.
    </EmptyState>
  )
}

export default async function IdeaTypesPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [ideaTypes, organizations] = await Promise.all([getIdeaTypes(), getOrganizations()])
  const siteAdmin = currentUser().role === 'SiteAdmin'
  const rows = siteAdmin
    ? ideaTypes
    : ideaTypes.filter((type) => type.organizationId === 'acme-robotics')

  return (
    <SettingsPage
      title={siteAdmin ? 'All idea types' : 'Idea types'}
      gate="idea types"
      lead={
        siteAdmin
          ? 'Idea types across every organization. Open an organization to change its types.'
          : "The kinds of idea people may raise. An idea's type is set at creation and immutable after, because it decides which custom fields the idea asks for."
      }
      // No create control for a Site Admin: an idea type belongs to one organization, so there is
      // nothing for a button on the combined list to create. Comp Q marks it data-roles="OrgAdmin".
      actions={siteAdmin ? undefined : <Button>Add idea type</Button>}
    >
      {siteAdmin ? <CrossOrgNote what="An idea type" /> : null}
      {rows.length === 0 ? (
        <NoIdeaTypes siteAdmin={siteAdmin} />
      ) : (
        <AdminTable
          summary={
            siteAdmin
              ? `${rows.length} idea types across ${organizations.length} organizations.`
              : `${rows.length} idea types.`
          }
        >
          <thead>
            <tr className="border-b bg-muted/40">
              <Th>Name</Th>
              {siteAdmin ? <Th className="w-56">Organization</Th> : null}
              <Th>Description</Th>
              <Th className="w-28">Fields</Th>
              <Th className="w-28">Ideas</Th>
              <Th className="w-24">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((type) => (
              <tr key={type.id} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{type.name}</td>
                {siteAdmin ? (
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {organizations.find((org) => org.id === type.organizationId)?.name}
                  </td>
                ) : null}
                <td className="px-4 py-2.5 text-muted-foreground">{type.description}</td>
                <td className="px-4 py-2.5 tabular-nums">{type.fieldCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{type.ideaCount}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${siteAdmin ? 'Manage' : 'Edit'} ${type.name}`}
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
