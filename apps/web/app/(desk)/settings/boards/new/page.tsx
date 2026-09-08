import { BoardForm, BoardRefusal } from '@/components/settings/board-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { currentUser } from '@/lib/mock'

export const metadata = { title: 'New board · Collega' }

export default function NewBoardPage() {
  // A Site Admin passes `isAdministrator`, so the default gate would hand them a form whose save
  // is refused on every path. Branch first; a User or Read Only still falls through to the
  // administrators-only refusal `SettingsPage` owns.
  if (currentUser.role === 'SiteAdmin') {
    return <BoardRefusal title="New board" reading="board creation" />
  }

  return (
    <SettingsPage
      title="New board"
      gate="boards"
      lead="Name it, then choose which of this organization’s statuses become its columns."
    >
      <BoardForm
        userStatusMoves={true}
        swimlaneIds={['new', 'review']}
        submitLabel="Create board"
        explainerHeading="New board"
      />
    </SettingsPage>
  )
}
