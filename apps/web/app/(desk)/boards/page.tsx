import { UsageViewed } from '@/components/analytics/usage-viewed'
import type { BoardFormData, BoardView } from '@/components/boards/board-drawer'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { loadPullSetup } from '@/components/boards/load-pull-setup'
import { Topbar } from '@/components/nav/topbar'
import {
  type BoardOverview,
  getBoard,
  getBoardOverviews,
  getIdeaTypeChoices,
  getReferenceContext,
  getStatuses,
  SWIMLANE_FLOOR,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, boardCreateDenial, currentUser } from '@/lib/session'
import type { AllowedIdeaTypesSetup, BoardLane, LaneFlags } from '@/lib/types'

export const metadata = { title: 'Boards · Collega' }

function laneFlagsOf(lanes: BoardLane[]): Record<string, LaneFlags> {
  return Object.fromEntries(
    lanes.map(({ id, isFinal, referencesBoardId, autoCreateTask }) => [
      id,
      { isFinal, referencesBoardId, autoCreateTask },
    ]),
  )
}

type Search = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * The board form's seed values, when the URL asks for a form this role may open: `?board=new`, or
 * `?board={id}&mode=edit` on a board that is not archived. Anything else opens no form, and the
 * screen falls back to the view (or to nothing).
 */
async function formFor(
  search: Search,
  boards: BoardOverview[],
  isAdmin: boolean,
): Promise<BoardFormData | null> {
  const requested = first(search.board)
  const archivedBoardIds = boards.filter((board) => board.isArchived).map((board) => board.id)

  if (requested === 'new') {
    const [statuses, pull, references, choices] = await Promise.all([
      getStatuses(),
      loadPullSetup({ isAdmin, archivedBoardIds }),
      getReferenceContext(null),
      getIdeaTypeChoices(),
    ])
    return {
      boardId: null,
      name: '',
      description: '',
      // The first lanes of the catalog, because the API refuses a board with fewer than two and a
      // form that opens below its own floor cannot be submitted until the person works out why.
      swimlaneIds: statuses.slice(0, SWIMLANE_FLOOR).map((status) => status.id),
      ideaFeaturesEnabled: true,
      // The creator may set it, and a creator is who is on this form.
      allowedIdeaTypes: { choices, selectedIds: [] },
      references,
      statuses,
      pull,
    }
  }

  const listed = boards.find((board) => board.id === requested)
  if (first(search.mode) !== 'edit' || !listed || listed.isArchived) return null

  const [board, statuses, pull, references] = await Promise.all([
    getBoard(listed.id),
    getStatuses(),
    loadPullSetup({ isAdmin, archivedBoardIds }),
    getReferenceContext(listed.id),
  ])
  if (!board) return null
  const allowedIdeaTypes: AllowedIdeaTypesSetup | undefined = board.canSetAllowedIdeaTypes
    ? { choices: await getIdeaTypeChoices(), selectedIds: board.allowedIdeaTypeIds }
    : undefined
  return {
    boardId: board.id,
    name: board.name,
    description: board.description ?? '',
    swimlaneIds: board.lanes.map((lane) => lane.id),
    laneFlags: laneFlagsOf(board.lanes),
    laneIdeaCounts: Object.fromEntries(listed.lanes.map((lane) => [lane.id, lane.ideaCount])),
    ideaFeaturesEnabled: board.ideaFeaturesEnabled,
    allowedIdeaTypes,
    references,
    // A lane whose status has since been archived is missing from the catalog; merging it in keeps
    // it visible and removable rather than silently dropped on the next save (as Settings does).
    statuses: [
      ...statuses,
      ...board.lanes.filter((lane) => !statuses.some((status) => status.id === lane.id)),
    ],
    pull,
  }
}

/**
 * The viewed board's lanes with their Board References flags, for the drawer's read-only list. Names
 * what a lane references from the list already read, so it costs one request beyond it.
 */
async function viewFor(search: Search, boards: BoardOverview[]): Promise<BoardView | null> {
  const requested = first(search.board)
  const listed = boards.find((board) => board.id === requested)
  if (!listed) return null
  const board = await getBoard(listed.id)
  if (!board) return null
  return {
    boardId: board.id,
    lanes: board.lanes,
    flags: laneFlagsOf(board.lanes),
    references: {
      choices: boards
        .filter((other) => other.id !== board.id)
        .map((other) => ({
          id: other.id,
          name: other.name,
          keyPrefix: other.keyPrefix,
          firstLaneName: other.lanes[0]?.name ?? null,
          hasReferenceLane: false,
        })),
      referencedBy: [],
    },
  }
}

export default async function BoardsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const search = await searchParams
  const adminDenial = boardAdminDenial(currentUser().role)
  const createDenial = boardCreateDenial(currentUser().role)
  // One request for every board, archived ones included: the Status filter, sorting and paging all
  // happen in the client, and the lane counts, top tags and creator arrive on each list item.
  const boards = await getBoardOverviews({ includeArchived: true })
  // Creating is open to a User too; editing an existing board is not.
  const formDenial = first(search.board) === 'new' ? createDenial : adminDenial
  const form = formDenial === null ? await formFor(search, boards, adminDenial === null) : null
  const view = form === null ? await viewFor(search, boards) : null
  // The quick-add row's lanes: the first of the catalog, as the drawer defaults them.
  const quickAddLaneIds =
    createDenial === null
      ? (await getStatuses()).slice(0, SWIMLANE_FLOOR).map((status) => status.id)
      : []

  return (
    <>
      <UsageViewed type="list.viewed" props={{ list: 'boards' }} />
      {/* No "New idea" here, by design: this screen chooses a board rather than acting on one, and
          an idea is always raised against a board. */}
      <Topbar title={<b>Boards</b>} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <BoardsScreen
          boards={boards}
          adminDenial={adminDenial}
          createDenial={createDenial}
          form={form}
          view={view}
          quickAddLaneIds={quickAddLaneIds}
        />
      </main>
    </>
  )
}
