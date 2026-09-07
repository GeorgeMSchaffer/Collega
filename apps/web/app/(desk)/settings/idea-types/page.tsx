import { Button } from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { ideaTypes } from '@/lib/mock'

export const metadata = { title: 'Idea types · Collega' }

export default function IdeaTypesPage() {
  return (
    <SettingsPage
      title="Idea types"
      gate="idea types"
      lead="The kinds of idea people may raise. An idea's type is set at creation and immutable after, because it decides which custom fields the idea asks for."
      actions={<Button>Add idea type</Button>}
    >
      <AdminTable summary={`${ideaTypes.length} idea types.`}>
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Name</Th>
            <Th>Description</Th>
            <Th className="w-28">Fields</Th>
            <Th className="w-28">Ideas</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {ideaTypes.map((type) => (
            <tr key={type.id} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{type.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{type.description}</td>
              <td className="px-4 py-2.5 tabular-nums">{type.fieldCount}</td>
              <td className="px-4 py-2.5 tabular-nums">{type.ideaCount}</td>
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
