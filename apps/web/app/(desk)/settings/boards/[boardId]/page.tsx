import { notFound } from 'next/navigation'
import { BoardForm, BoardRefusal } from '@/components/settings/board-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getBoard, getBoardAdminEntry, getStatuses } from '@/lib/data'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Edit board · Collega' }

export default async function EditBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const [board, entry, statuses] = await Promise.all([
    getBoard(boardId),
    getBoardAdminEntry(boardId),
    getStatuses(),
  ])
  if (!board || !entry) notFound()

  if (currentUser.role === 'SiteAdmin') {
    return <BoardRefusal title="Edit board" reading="this board" />
  }

  return (
    <SettingsPage
      title="Edit board"
      gate="boards"
      lead={`${board.name} · ${entry.swimlaneIds.length} swimlanes, drawn from this organization’s statuses.`}
    >
      <BoardForm
        defaultName={board.name}
        userStatusMoves={entry.userStatusMoves}
        swimlaneIds={entry.swimlaneIds}
        statuses={statuses}
        submitLabel="Save changes"
        explainerHeading="Edit board"
      />
    </SettingsPage>
  )
}
