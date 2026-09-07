import { Badge, Button, Tag } from '@collega/design-system'
import { CrossOrgNote } from '@/components/settings/cross-org'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { currentUser, fieldDefinitions, organizations } from '@/lib/mock'

export const metadata = { title: 'Custom fields · Collega' }

export default function FieldsPage() {
  const siteAdmin = currentUser.role === 'SiteAdmin'
  const rows = siteAdmin
    ? fieldDefinitions
    : fieldDefinitions.filter((field) => field.organizationId === 'acme-robotics')

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
      <AdminTable
        summary={
          siteAdmin
            ? `${rows.length} fields across ${organizations.length} organizations.`
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
          {rows.map((field) => (
            <tr key={field.id} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{field.name}</td>
              {siteAdmin ? (
                <td className="px-4 py-2.5 text-muted-foreground">
                  {organizations.find((org) => org.id === field.organizationId)?.name}
                </td>
              ) : null}
              <td className="px-4 py-2.5 text-muted-foreground">{field.fieldType}</td>
              <td className="px-4 py-2.5">
                {field.required ? (
                  <Badge variant="secondary">Required</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Optional</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap gap-1.5">
                  {field.ideaTypeNames.map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                </span>
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
    </SettingsPage>
  )
}
