import { Avatar, Dot, Marker, Tag } from '@collega/design-system'
import Link from 'next/link'
import type { Idea } from '@/lib/mock'
import { PRIORITY_COLORS } from '@/lib/mock'

/**
 * A card in a lane (comp Q `.kcard`). Priority marker and assignee on the first row, tag and
 * upvotes on the second.
 *
 * `cursor-grab` is comp Q's, but nothing here drags yet: the board's own copy promises that a card
 * can be moved by drag *or* by focusing it and pressing the arrow keys, and both paths must land
 * together on a real endpoint. Half of that — a draggable card that cannot persist — would be worse
 * than neither.
 */
export function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="mb-1.5 block rounded-xl border bg-card p-3 text-foreground shadow-sm no-underline hover:shadow-md"
    >
      <span className="font-medium">{idea.title}</span>
      <div className="mt-2 flex items-center gap-2">
        <Marker>
          <Dot color={PRIORITY_COLORS[idea.priority]} />
          {idea.priority}
        </Marker>
        <span className="flex-1" />
        {idea.assigneeInitials ? (
          <Avatar initials={idea.assigneeInitials} className="size-5 text-[9px]" />
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Tag>{idea.tag}</Tag>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true">▲</span> {idea.upvotes}
        </span>
      </div>
    </Link>
  )
}
