import type { BoardFormData } from '@/components/boards/board-drawer'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { Topbar } from '@/components/nav/topbar'
import {
  type BoardOverview,
  getBoard,
  getBoardOverviews,
  getStatuses,
  SWIMLANE_FLOOR,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser } from '@/lib/session'

export const metadata = { title: 'Boards · Collega' }

type Search = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * The board form's seed values, when the URL asks for a form this role may open: `?board=new`, or
 * `?board={id}&mode=edit` on a board that is not archived. Anything else opens no form, and the
 * screen falls back to the view (or to nothing).
 */
async function formFor(search: Search, boards: BoardOverview[]): Promise<BoardFormData | null> {
  const requested = first(search.board)

  if (requested === 'new') {
    const statuses = await getStatuses()
    return {
      boardId: null,
      name: '',
      description: '',
      userStatusMoves: true,
      // The first lanes of the catalog, because the API refuses a board with fewer than two and a
      // form that opens below its own floor cannot be submitted until the person works out why.
      swimlaneIds: statuses.slice(0, SWIMLANE_FLOOR).map((status) => status.id),
      statuses,
    }
  }

  const listed = boards.find((board) => board.id === requested)
  if (first(search.mode) !== 'edit' || !listed || listed.isArchived) return null

  const [board, statuses] = await Promise.all([getBoard(listed.id), getStatuses()])
  if (!board) return null
  return {
    boardId: board.id,
    name: board.name,
    description: board.description ?? '',
    userStatusMoves: board.allowUserStatusUpdate,
    swimlaneIds: board.lanes.map((lane) => lane.id),
    // A lane whose status has since been archived is missing from the catalog; merging it in keeps
    // it visible and removable rather than silently dropped on the next save (as Settings does).
    statuses: [
      ...statuses,
      ...board.lanes.filter((lane) => !statuses.some((status) => status.id === lane.id)),
    ],
  }
}

export default async function BoardsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const search = await searchParams
  const adminDenial = boardAdminDenial(currentUser().role)
  // One request for every board, archived ones included: the Status filter, sorting and paging all
  // happen in the client, and the lane counts, top tags and creator arrive on each list item.
  const boards = await getBoardOverviews({ includeArchived: true })
  const form = adminDenial === null ? await formFor(search, boards) : null

  return (
    <>
      {/* No "New idea" here, by design: this screen chooses a board rather than acting on one, and
          an idea is always raised against a board. */}
      <Topbar title={<b>Boards</b>} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <BoardsScreen boards={boards} adminDenial={adminDenial} form={form} />
      </main>
    </>
  )
}
