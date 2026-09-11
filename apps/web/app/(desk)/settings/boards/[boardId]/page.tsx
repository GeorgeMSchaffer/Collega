import { notFound } from 'next/navigation'
import { BoardRefusal } from '@/components/settings/admin-only'
import { BoardForm } from '@/components/settings/board-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { getBoard, getStatuses } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Edit board · Collega' }

export default async function EditBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { boardId } = await params

  // The board's own lanes, not the organization's catalog: `getBoard` answers what this board
  // actually shows, in its own order, which is the thing being edited. The catalog beside it is
  // what may be added.
  const [board, statuses] = await Promise.all([getBoard(boardId), getStatuses()])
  if (!board) notFound()

  if (currentUser().role === 'SiteAdmin') {
    return <BoardRefusal title="Edit board" reading="this board" />
  }

  return (
    <SettingsPage
      title="Edit board"
      gate="boards"
      lead={`${board.name} · ${board.lanes.length} swimlanes, drawn from this organization’s statuses.`}
    >
      <BoardForm
        boardId={board.id}
        defaultName={board.name}
        userStatusMoves={board.allowUserStatusUpdate}
        swimlaneIds={board.lanes.map((lane) => lane.id)}
        // A board may hold a lane whose status has since been archived, and the catalog excludes
        // those. Merging them in is what keeps such a lane visible and removable rather than
        // silently dropped from the picker — and silently dropped from the board on the next save.
        statuses={[
          ...statuses,
          ...board.lanes.filter((lane) => !statuses.some((status) => status.id === lane.id)),
        ]}
        submitLabel="Save changes"
        explainerHeading="Edit board"
      />
    </SettingsPage>
  )
}
