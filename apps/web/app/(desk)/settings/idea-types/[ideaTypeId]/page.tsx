import { notFound } from 'next/navigation'
import { IdeaTypeEditForm } from '@/components/settings/idea-type-edit-form'
import { IdeaTypeFieldsPicker } from '@/components/settings/idea-type-fields-picker'
import { SettingsPage } from '@/components/settings/settings-page'
import { getFieldDefinitions, getFieldsets, getIdeaTypes } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Edit idea type · Collega' }

/**
 * Editing one idea type.
 *
 * The row is found in the catalog rather than fetched on its own, for the reason the status edit
 * page gives: there is no single-item read, so a reader for one would be a list read with a `find`
 * hidden inside it.
 */
export default async function EditIdeaTypePage({
  params,
}: {
  params: Promise<{ ideaTypeId: string }>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { ideaTypeId } = await params
  const [ideaTypes, fields, fieldsets] = await Promise.all([
    getIdeaTypes(),
    getFieldDefinitions(),
    getFieldsets(),
  ])
  const ideaType = ideaTypes.find((candidate) => candidate.id === ideaTypeId)
  if (!ideaType) notFound()

  return (
    <SettingsPage
      title={`Edit ${ideaType.name}`}
      gate="idea-types"
      lead="Renaming a type renames it everywhere it has been used. Below it, choose which fields its ideas ask for."
    >
      <div className="flex flex-col gap-8">
        <div className="max-w-md">
          <IdeaTypeEditForm ideaType={ideaType} />
        </div>
        <section aria-labelledby="idea-type-fields" className="flex flex-col gap-3 border-t pt-6">
          <h2 id="idea-type-fields" className="m-0 text-base font-semibold">
            Fields on this type
          </h2>
          <IdeaTypeFieldsPicker ideaType={ideaType} fields={fields} fieldsets={fieldsets} />
        </section>
      </div>
    </SettingsPage>
  )
}
