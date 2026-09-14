import { notFound } from 'next/navigation'
import { IdeaTypeEditForm } from '@/components/settings/idea-type-edit-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getIdeaTypes } from '@/lib/data'
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
  const ideaType = (await getIdeaTypes()).find((candidate) => candidate.id === ideaTypeId)
  if (!ideaType) notFound()

  return (
    <SettingsPage
      title={`Edit ${ideaType.name}`}
      gate="idea-types"
      lead="Renaming a type renames it everywhere it has been used. Which fields it asks for is set separately."
    >
      <div className="max-w-md">
        <IdeaTypeEditForm ideaType={ideaType} />
      </div>
    </SettingsPage>
  )
}
