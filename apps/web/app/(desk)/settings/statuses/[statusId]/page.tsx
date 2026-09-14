import { notFound } from 'next/navigation'
import { SettingsPage } from '@/components/settings/settings-page'
import { StatusEditForm } from '@/components/settings/status-edit-form'
import { getStatuses } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Edit status · Collega' }

/**
 * Editing one status.
 *
 * **The row is found in the catalog rather than fetched on its own.** There is no
 * `GET /statuses/{id}` — the API exposes the catalog per organization and addresses a single row
 * only for writes — so a reader for one status would be a list read with a `find` hidden inside
 * it. Doing the `find` here keeps that visible, and costs the same request either way.
 *
 * A Site Admin reaching this page gets an empty catalog from `getStatuses` (they belong to no
 * organization) and therefore a 404 rather than a form. That is the right answer for the wrong
 * reason — the real one is that the API refuses them every organization-content mutation — but the
 * list they come from shows them `Manage` on another organization's rows, so landing on "not
 * found" would be confusing. It does not arise: that button is not a link for them.
 */
export default async function EditStatusPage({
  params,
}: {
  params: Promise<{ statusId: string }>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { statusId } = await params
  const status = (await getStatuses()).find((candidate) => candidate.id === statusId)
  if (!status) notFound()

  return (
    <SettingsPage
      title={`Edit ${status.name}`}
      gate="statuses"
      lead="Renaming a status renames the lane on every board. Order is set on the list, not here."
    >
      <div className="max-w-md">
        <StatusEditForm status={status} />
      </div>
    </SettingsPage>
  )
}
