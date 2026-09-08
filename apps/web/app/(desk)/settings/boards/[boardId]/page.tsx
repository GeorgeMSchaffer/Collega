import { notFound } from 'next/navigation'
import { BoardForm, BoardRefusal } from '@/components/settings/board-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { boardAdminById, boardById, currentUser } from '@/lib/mock'

export const metadata = { title: 'Edit board · Collega' }

export default async function EditBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = boardById(boardId)
  const entry = boardAdminById(boardId)
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
        submitLabel="Save changes"
        explainerHeading="Edit board"
      />
    </SettingsPage>
  )
}
