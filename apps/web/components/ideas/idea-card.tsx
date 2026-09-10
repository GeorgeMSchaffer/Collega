import { Avatar, Dot, Marker, Tag } from '@collega/design-system'
import Link from 'next/link'
import type { Idea } from '@/lib/data'
import { PRIORITY_COLORS } from '@/lib/display'
import { CardActions } from './card-actions'

/**
 * A card in a lane (comp Q `.kcard`). Priority marker and assignee on the first row, tag, upvote
 * and the move controls on the second.
 *
 * **The title is the link, not the whole card.** It used to be the card, which was tidier to read
 * and became impossible the moment a card carried a button: a `<button>` inside an `<a>` is invalid
 * HTML, and browsers recover from it by breaking one of the two — usually the button, which is the
 * half that writes. Comp Q's `.kcard` is not an anchor either.
 *
 * `cursor-grab` is gone with it. It promised a drag this board does not implement; the arrows below
 * are what actually moves a card, and a cursor that says otherwise is a lie the pointer tells before
 * anyone reads the copy.
 */
export function IdeaCard({
  idea,
  boardId,
  previousStatusId,
  nextStatusId,
  canMove,
  upvoteDenial,
}: {
  idea: Idea
  boardId: string
  previousStatusId: string | null
  nextStatusId: string | null
  canMove: boolean
  upvoteDenial: string | null
}) {
  return (
    <div className="mb-1.5 rounded-xl border bg-card p-3 text-foreground shadow-sm hover:shadow-md">
      <Link href={`/ideas/${idea.id}`} className="font-medium text-foreground no-underline">
        {idea.title}
      </Link>
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
      {/* `flex-wrap`, so a refusal from either control below drops onto its own line instead of
          squeezing the controls it explains. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Real ideas frequently carry no tag at all, where every fixture idea had exactly one.
            An empty chip is worse than none: it reads as a tag whose name failed to load. */}
        {idea.tag ? <Tag>{idea.tag}</Tag> : null}
        <span className="flex-1" />
        <CardActions
          idea={idea}
          boardId={boardId}
          previousStatusId={previousStatusId}
          nextStatusId={nextStatusId}
          canMove={canMove}
          upvoteDenial={upvoteDenial}
        />
      </div>
    </div>
  )
}
