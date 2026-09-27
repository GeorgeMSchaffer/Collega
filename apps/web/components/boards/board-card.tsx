import { Card } from '@collega/design-system'
import Link from 'next/link'
import type { BoardOverview } from '@/lib/types'
import { BoardEditAction, createdLine, LaneLegend, LaneStrip, TopTags } from './board-parts'

/** The Boards screen's card view: description, lane mix, top tags, and who made it when. */
export function BoardCard({
  board,
  editDenial,
}: {
  board: BoardOverview
  editDenial: string | null
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <h2 className="m-0 text-base font-semibold">
          <Link href={`/boards/${board.id}`}>{board.name}</Link>
        </h2>
        <BoardEditAction board={board} denial={editDenial} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pt-2 pb-4">
        {board.description ? (
          <p className="m-0 line-clamp-2 text-sm text-muted-foreground">{board.description}</p>
        ) : (
          <p className="m-0 text-sm text-muted-foreground italic opacity-80">No description yet.</p>
        )}
        <LaneStrip board={board} />
        {board.ideaCount === 0 ? (
          <p className="m-0 text-xs text-muted-foreground">No ideas yet</p>
        ) : (
          <LaneLegend board={board} />
        )}
        <TopTags board={board} limit={3} />
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t px-5 py-2.5 text-xs text-muted-foreground tabular-nums">
        <span>{createdLine(board)}</span>
        <span>
          {board.ideaCount} ideas · {board.laneCount} lanes
        </span>
      </div>
    </Card>
  )
}
