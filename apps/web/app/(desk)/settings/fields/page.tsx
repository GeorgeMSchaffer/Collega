import { Badge, Button, buttonVariants, EmptyState, Tag } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { getFieldDefinitions, getFieldDefinitionsByOrganization } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Custom fields · Collega' }

/**
 * The cross-organization empty state offers navigation, not creation: a field belongs to one
 * organization, so there is nothing here for a create control to create.
 */
function NoFields({ siteAdmin }: { siteAdmin: boolean }) {
  if (siteAdmin) {
    return (
      <EmptyState
        heading="No fields anywhere yet"
        action={
          <Link href="/settings/organizations" className={buttonVariants({ variant: 'outline' })}>
            Go to Organizations
          </Link>
        }
      >
        No organization has configured fields. Open an organization to set its fields up &mdash;
        they cannot be created from this cross-organization view.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      heading="No custom fields yet"
      action={<GatedAction id="why-add-first-field" label="Add the first field" denial={null} />}
    >
      Fields you define here become available to idea types, which choose the subset their ideas
      show. Nothing appears on an idea until a type picks it up.
    </EmptyState>
  )
}

export default async function FieldsPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const siteAdmin = currentUser().role === 'SiteAdmin'

  const catalogs = siteAdmin
    ? await getFieldDefinitionsByOrganization()
    : [{ organization: currentUser().organizationName ?? '', fields: await getFieldDefinitions() }]

  const rows = catalogs.flatMap((catalog) =>
    catalog.fields.map((field) => ({ field, org: catalog.organization })),
  )

  return (
    <SettingsPage
      title={siteAdmin ? 'All fields' : 'Custom fields'}
      gate="custom fields"
      lead={
        siteAdmin
          ? 'Custom fields across every organization. Open an organization to change its fields.'
          : "Extra questions attached to an idea type. A field appears on an idea only when that idea's type asks for it."
      }
      actions={siteAdmin ? undefined : <Button>Add field</Button>}
    >
      {siteAdmin ? <CrossOrgNote what="A field" /> : null}
      {rows.length === 0 ? (
        <NoFields siteAdmin={siteAdmin} />
      ) : (
        <AdminTable
          summary={
            siteAdmin
              ? `${rows.length} fields across ${catalogs.length} organizations.`
              : `${rows.length} fields.`
          }
        >
          <thead>
            <tr className="border-b bg-muted/40">
              <Th>Name</Th>
              {siteAdmin ? <Th className="w-56">Organization</Th> : null}
              <Th className="w-32">Type</Th>
              <Th className="w-28">Required</Th>
              <Th>Used by</Th>
              <Th className="w-24">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ field, org }) => (
              <tr key={`${org}-${field.id}`} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{field.name}</td>
                {siteAdmin ? <td className="px-4 py-2.5 text-muted-foreground">{org}</td> : null}
                <td className="px-4 py-2.5 text-muted-foreground">{field.fieldType}</td>
                <td className="px-4 py-2.5">
                  {field.required ? (
                    <Badge variant="secondary">Required</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optional</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {field.usedBy.length === 0 ? (
                    // Reachable, and not the same as "no types exist": every type in the
                    // organization can be `Curated` and none of them have selected this field, so
                    // it is defined and shown nowhere.
                    <span className="text-xs text-muted-foreground">No idea type</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {field.usedBy.map((name) => (
                        <Tag key={name}>{name}</Tag>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${siteAdmin ? 'Manage' : 'Edit'} ${field.name}`}
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
