import { notFound } from 'next/navigation'
import { FieldsetEditForm } from '@/components/settings/fieldset-edit-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getFieldDefinitions, getFieldset } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Edit fieldset · Collega' }

/**
 * Editing one fieldset. `null` means the reader had no organization to scope to (a Site Admin),
 * which is a 404 for the reason the field edit page gives: the list does not link them here.
 */
export default async function EditFieldsetPage({
  params,
}: {
  params: Promise<{ fieldsetId: string }>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { fieldsetId } = await params
  const [fieldset, fields] = await Promise.all([getFieldset(fieldsetId), getFieldDefinitions()])
  if (!fieldset) notFound()

  return (
    <SettingsPage
      title={`Edit ${fieldset.name}`}
      gate="fieldsets"
      lead="Which fields this set holds, and in what order. Idea types that use it pick up every change."
    >
      <div className="max-w-2xl">
        <FieldsetEditForm fieldset={fieldset} fields={fields} />
      </div>
    </SettingsPage>
  )
}
