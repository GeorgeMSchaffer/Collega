import { Badge, Dot, Tag, TagChip } from '@collega/design-system'
import type { BoardOverview } from '@/lib/types'

/**
 * The board's ideas as one bar split by lane, in the board's lane order and status colours.
 *
 * Decorative: the same counts are always rendered as text beside it (the legend on a card, the
 * figures in a row), so a screen reader gets them once rather than twice.
 */
export function LaneStrip({ board }: { board: BoardOverview }) {
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      {board.lanes
        .filter((lane) => lane.ideaCount > 0)
        .map((lane) => (
          <span
            key={lane.id}
            className="h-full"
            style={{ flexGrow: lane.ideaCount, background: lane.color }}
          />
        ))}
    </div>
  )
}

/** Every lane with its count. Empty lanes stay, dimmed, so two boards list the same lanes. */
export function LaneLegend({ board }: { board: BoardOverview }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-muted-foreground tabular-nums">
      {board.lanes.map((lane) => (
        <li
          key={lane.id}
          className={`inline-flex items-center gap-1.5 ${lane.ideaCount === 0 ? 'opacity-60' : ''}`}
        >
          <Dot color={lane.color} />
          {lane.ideaCount} {lane.name}
        </li>
      ))}
    </ul>
  )
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
