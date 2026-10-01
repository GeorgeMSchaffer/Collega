import { Badge, Dot, Tag, TagChip } from '@collega/design-system'
import type { BoardOverview } from '@/lib/types'

/** One counted segment of a strip and its legend: a lane, or a delivery status. */
export type CountSegment = { id: string; name: string; color: string; count: number }

/**
 * Counts as one bar split by segment, in the order given — a board's lanes, a sprint's delivery
 * statuses.
 *
 * Decorative: the same counts are always rendered as text beside it (the legend on a card, the
 * figures in a row), so a screen reader gets them once rather than twice.
 */
export function CountStrip({ segments }: { segments: readonly CountSegment[] }) {
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <span
            key={segment.id}
            className="h-full"
            style={{ flexGrow: segment.count, background: segment.color }}
          />
        ))}
    </div>
  )
}

/** Every segment with its count. Empty ones stay, dimmed, so two strips list the same segments. */
export function CountLegend({ segments }: { segments: readonly CountSegment[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-muted-foreground tabular-nums">
      {segments.map((segment) => (
        <li
          key={segment.id}
          className={`inline-flex items-center gap-1.5 ${segment.count === 0 ? 'opacity-60' : ''}`}
        >
          <Dot color={segment.color} />
          {segment.count} {segment.name}
        </li>
      ))}
    </ul>
  )
}

function laneSegments(board: BoardOverview): CountSegment[] {
  return board.lanes.map((lane) => ({ ...lane, count: lane.ideaCount }))
}

/** The board's ideas as one bar split by lane, in the board's lane order and status colours. */
export function LaneStrip({ board }: { board: BoardOverview }) {
  return <CountStrip segments={laneSegments(board)} />
}

/** Every lane with its count. */
export function LaneLegend({ board }: { board: BoardOverview }) {
  return <CountLegend segments={laneSegments(board)} />
}

/** The most-used tags on the board's ideas, then how many more there are. */
export function TopTags({ board, limit }: { board: BoardOverview; limit: number }) {
  const shown = board.topTags.slice(0, limit)
  if (shown.length === 0) return null
  const more = board.tagCount - shown.length

  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Most-used tags">
      {shown.map((tag) => (
        <li key={tag.name}>
          <TagChip color={tag.color}>{tag.name}</TagChip>
        </li>
      ))}
      {more > 0 ? (
        <li>
          <Tag className="border-dashed">+{more}</Tag>
        </li>
      ) : null}
    </ul>
  )
}

/**
 * First lane, everything between, last lane — so boards with different lanes still compare in one
 * column. A board of two lanes has nothing in between, and says so by omitting it.
 */
export function LaneFigures({ board }: { board: BoardOverview }) {
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

export function statusLabel(board: BoardOverview): 'Active' | 'Archived' {
  return board.isArchived ? 'Archived' : 'Active'
}

export function BoardStatus({ board }: { board: BoardOverview }) {
  return <Badge variant={board.isArchived ? 'outline' : 'success'}>{statusLabel(board)}</Badge>
}

export function createdLine(board: BoardOverview): string {
  return board.createdBy
    ? `Created by ${board.createdBy} · ${board.createdOn}`
    : `Created ${board.createdOn}`
}
