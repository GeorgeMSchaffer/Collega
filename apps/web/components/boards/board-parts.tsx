import { buttonVariants, Dot, Tag } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
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
          <Tag>{tag.name}</Tag>
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

/** Edit, live for an Org Admin and disabled with the reason for everyone else. */
export function BoardEditAction({
  board,
  denial,
}: {
  board: BoardOverview
  denial: string | null
}) {
  return (
    <GatedAction
      id={`why-edit-${board.id}`}
      label="Edit"
      deniedLabel={`Edit ${board.name}`}
      denial={denial}
      variant="ghost"
      size="sm"
    >
      <Link
        href={`/settings/boards/${board.id}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        aria-label={`Edit ${board.name}`}
      >
        Edit
      </Link>
    </GatedAction>
  )
}

export function createdLine(board: BoardOverview): string {
  return board.createdBy
    ? `Created by ${board.createdBy} · ${board.createdOn}`
    : `Created ${board.createdOn}`
}
