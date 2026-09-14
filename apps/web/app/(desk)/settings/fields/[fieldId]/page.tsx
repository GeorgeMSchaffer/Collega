import { notFound } from 'next/navigation'
import { FieldEditForm } from '@/components/settings/field-edit-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getFieldDefinitionDetail } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Edit field · Collega' }

/**
 * Editing one custom field.
 *
 * Unlike the two catalog pages this reads its record from the API: the single-item route exists,
 * and it is the only one that carries the options and the description the form has to post back.
 *
 * `null` means the reader had no organization to scope the request to — a Site Admin, who belongs
 * to none. That is a 404 rather than a refusal panel because the list does not link them here in
 * the first place, so arriving is a typed URL rather than a route the product offered.
 */
export default async function EditFieldPage({ params }: { params: Promise<{ fieldId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { fieldId } = await params
  const field = await getFieldDefinitionDetail(fieldId)
  if (!field) notFound()

  return (
    <SettingsPage
      title={`Edit ${field.name}`}
      gate="fields"
      lead="What this field is called, whether it must be answered, and the choices it offers."
    >
      <div className="max-w-2xl">
        <FieldEditForm field={field} />
      </div>
    </SettingsPage>
  )
}
