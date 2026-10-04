import { Button, buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { FieldsetForm } from '@/components/settings/fieldset-form'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { getFieldsets, getFieldsetsByOrganization } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Fieldsets · Collega' }

/** The cross-organization empty state offers navigation, not creation, as the Fields list does. */
function NoFieldsets({ siteAdmin }: { siteAdmin: boolean }) {
  if (siteAdmin) {
    return (
      <EmptyState
        heading="No fieldsets anywhere yet"
        action={
          <Link href="/settings/organizations" className={buttonVariants({ variant: 'outline' })}>
            Go to Organizations
          </Link>
        }
      >
        No organization has any fieldsets. Open an organization to set them up &mdash; they cannot
        be created from this cross-organization view.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      heading="No fieldsets yet"
      action={
        <GatedAction id="why-add-first-fieldset" label="Add the first fieldset" denial={null}>
          <a href="#add-fieldset" className={buttonVariants()}>
            Add the first fieldset
          </a>
        </GatedAction>
      }
    >
      A fieldset groups custom fields so several idea types can ask for the same questions. Nothing
      appears on an idea until a type uses the set.
    </EmptyState>
  )
}

export default async function FieldsetsPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const siteAdmin = currentUser().role === 'SiteAdmin'

  const catalogs = siteAdmin
    ? await getFieldsetsByOrganization()
    : [{ organization: currentUser().organizationName ?? '', fieldsets: await getFieldsets() }]

  const rows = catalogs.flatMap((catalog) =>
    catalog.fieldsets.map((fieldset) => ({ fieldset, org: catalog.organization })),
  )

  return (
    <SettingsPage
      title={siteAdmin ? 'All fieldsets' : 'Fieldsets'}
      gate="fieldsets"
      lead={
        siteAdmin
          ? 'Fieldsets across every organization. Open an organization to change its fieldsets.'
          : 'Reusable groups of custom fields. An idea type can use a set instead of picking each field, and edits to a set reach every type that uses it.'
      }
      actions={
        siteAdmin ? undefined : (
          <a href="#add-fieldset" className={buttonVariants()}>
            Add New Fieldset
          </a>
        )
      }
    >
      {siteAdmin ? <CrossOrgNote what="A fieldset" /> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <NoFieldsets siteAdmin={siteAdmin} />
          ) : (
            <AdminTable
              summary={
                siteAdmin
                  ? `${rows.length} fieldsets across ${catalogs.length} organizations.`
                  : `${rows.length} fieldsets.`
              }
            >
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th>Name</Th>
                  {siteAdmin ? <Th className="w-56">Organization</Th> : null}
                  <Th>Description</Th>
                  <Th className="w-24">Fields</Th>
                  <Th className="w-36">Used by</Th>
                  <Th className="w-24">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ fieldset, org }) => (
                  <tr key={`${org}-${fieldset.id}`} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{fieldset.name}</td>
                    {siteAdmin ? (
                      <td className="px-4 py-2.5 text-muted-foreground">{org}</td>
                    ) : null}
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {fieldset.description ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">{fieldset.fields.length}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {fieldset.usedByIdeaTypeCount === 0
                        ? 'No idea type'
                        : `Used by ${String(fieldset.usedByIdeaTypeCount)} type${fieldset.usedByIdeaTypeCount === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {/* Disabled for a Site Admin rather than linked: the edit page has no
                      organization to scope to. */}
                      {siteAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          aria-label={`Manage ${fieldset.name}`}
                        >
                          Manage
                        </Button>
                      ) : (
                        <Link
                          href={`/settings/fieldsets/${fieldset.id}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          aria-label={`Edit ${fieldset.name}`}
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </div>

        {siteAdmin ? null : <FieldsetForm />}
      </div>
    </SettingsPage>
  )
}
