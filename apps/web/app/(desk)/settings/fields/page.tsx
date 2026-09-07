import { Badge, Button, Tag } from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { fieldDefinitions } from '@/lib/mock'

export const metadata = { title: 'Custom fields · Collega' }

export default function FieldsPage() {
  return (
    <SettingsPage
      title="Custom fields"
      gate="custom fields"
      lead="Extra questions attached to an idea type. A field appears on an idea only when that idea's type asks for it."
      actions={<Button>Add field</Button>}
    >
      <AdminTable summary={`${fieldDefinitions.length} fields.`}>
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Name</Th>
            <Th className="w-32">Type</Th>
            <Th className="w-28">Required</Th>
            <Th>Used by</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {fieldDefinitions.map((field) => (
            <tr key={field.id} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{field.name}</td>
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
