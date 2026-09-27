import Link from 'next/link'
import type { BoardOverview } from '@/lib/types'
import { BoardEditAction, LaneStrip, TopTags } from './board-parts'

/**
 * First lane, everything between, last lane — so boards with different lanes still compare in one
 * column. A board of two lanes has nothing in between, and says so by omitting it.
 */
function LaneFigures({ board }: { board: BoardOverview }) {
  const first = board.lanes[0]
  const last = board.lanes.length > 1 ? board.lanes[board.lanes.length - 1] : undefined
  const between = board.lanes.slice(1, -1).reduce((sum, lane) => sum + lane.ideaCount, 0)

  return (
    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
      <span>
        <b className="font-semibold text-foreground">{board.ideaCount}</b> ideas
      </span>
      {first ? (
        <span>
          {first.ideaCount} {first.name}
        </span>
      ) : null}
      {board.lanes.length > 2 ? <span>{between} in between</span> : null}
      {last ? (
        <span>
          {last.ideaCount} {last.name}
        </span>
      ) : null}
    </div>
  )
}

/** The Boards screen's list view: one row per board, the same facts in fixed columns. */
export function BoardTable({
  boards,
  editDenial,
}: {
  boards: BoardOverview[]
  editDenial: string | null
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <th className="px-4 py-2 font-medium">Board</th>
            <th className="w-[26%] px-4 py-2 font-medium">Ideas by lane</th>
            <th className="w-[18%] px-4 py-2 font-medium">Top tags</th>
            <th className="w-[14%] px-4 py-2 font-medium">Created</th>
            <th className="w-44 px-4 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {boards.map((board) => (
            <tr
              key={board.id}
              className="border-b align-middle last:border-0 hover:bg-muted/40 hover:shadow-[inset_3px_0_0_var(--color-primary)]"
            >
              <td className="max-w-0 px-4 py-3">
                <Link href={`/boards/${board.id}`} className="font-semibold">
                  {board.name}
                </Link>
                <p className="m-0 truncate text-xs text-muted-foreground">
                  {board.description ?? <span className="italic">No description yet.</span>}
                </p>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1.5">
                  <LaneStrip board={board} />
                  <LaneFigures board={board} />
                </div>
              </td>
              <td className="px-4 py-3">
                <TopTags board={board} limit={2} />
              </td>
              <td className="px-4 py-3 text-xs leading-snug text-muted-foreground">
                {board.createdBy ? (
                  <>
                    {board.createdBy}
                    <br />
                  </>
                ) : null}
                {board.createdOn}
              </td>
              <td className="px-4 py-3 text-right">
                <BoardEditAction board={board} denial={editDenial} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
