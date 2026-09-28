import { Card } from '@collega/design-system'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { BoardOverview } from '@/lib/types'
import { BoardStatus, createdLine, LaneLegend, LaneStrip, TopTags } from './board-parts'

/**
 * The Boards screen's card view: description, lane mix, top tags, who made it when, and the same
 * row actions as the list.
 */
export function BoardCard({ board, actions }: { board: BoardOverview; actions: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        {/* The list pattern's rows sit under the page's h1, so a card title is an h2. */}
        <h2 className="m-0 text-base font-semibold">
          <Link href={`/boards/${board.id}`}>{board.name}</Link>
        </h2>
        {board.isArchived ? <BoardStatus board={board} /> : null}
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-1.5 text-xs text-muted-foreground tabular-nums">
        <span>{createdLine(board)}</span>
        <span className="inline-flex items-center gap-2">
          {board.ideaCount} ideas · {board.laneCount} lanes
          {actions}
        </span>
      </div>
    </Card>
  )
}
