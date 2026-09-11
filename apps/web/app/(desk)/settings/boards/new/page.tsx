import { BoardForm, BoardRefusal } from '@/components/settings/board-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getStatuses, SWIMLANE_FLOOR } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'New board · Collega' }

export default async function NewBoardPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  // A Site Admin passes `isAdministrator`, so the default gate would hand them a form whose save
  // is refused on every path. Branch first; a User or Read Only still falls through to the
  // administrators-only refusal `SettingsPage` owns.
  if (currentUser().role === 'SiteAdmin') {
    return <BoardRefusal title="New board" reading="board creation" />
  }

  const statuses = await getStatuses()

  return (
    <SettingsPage
      title="New board"
      gate="boards"
      lead="Name it, then choose which of this organization’s statuses become its columns."
    >
      <BoardForm
        userStatusMoves={true}
        // The first lanes of the catalog, because the API refuses a board with fewer than two and
        // a form that opens below its own floor cannot be submitted until the person works out
        // why. Which two is not a decision worth making for them — the picker is right there —
        // but starting at the minimum with the catalog's own leading statuses is.
        swimlaneIds={statuses.slice(0, SWIMLANE_FLOOR).map((status) => status.id)}
        statuses={statuses}
        submitLabel="Create board"
        explainerHeading="New board"
      />
    </SettingsPage>
  )
}
