import { cn } from '@collega/design-system'
import type { Idea } from '@/lib/types'
import { CardActions } from './card-actions'
import { People, PriorityMarker, TagList } from './idea-chips'

/**
 * A card in a lane (comp R `.kcard`): the title, which opens the drawer, then priority and
 * assignees, then the first tag beside the upvote and move controls.
 *
 * **The title is the button, not the whole card.** A card carries its own buttons, and a button
 * inside a button is invalid HTML that browsers repair by breaking one of the two.
 */
export function IdeaCard({
  idea,
  boardId,
  previousStatusId,
  nextStatusId,
  canMove,
  upvoteDenial,
  selected,
  onOpen,
}: {
  idea: Idea
  boardId: string
  previousStatusId: string | null
  nextStatusId: string | null
  canMove: boolean
  upvoteDenial: string | null
  selected: boolean
  onOpen: (trigger: HTMLButtonElement) => void
}) {
  return (
    <div
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-[10px] border bg-card p-2.5 text-foreground hover:border-primary',
        selected && 'outline-2 -outline-offset-1 outline-primary',
      )}
    >
      <button
        type="button"
        onClick={(event) => onOpen(event.currentTarget)}
        className="text-left text-[13px] leading-snug font-semibold hover:text-accent-foreground hover:underline"
      >
        {idea.title}
      </button>
      <div className="flex items-center justify-between gap-1.5">
        <PriorityMarker priority={idea.priority} />
        <People people={idea.assignees} quiet />
      </div>
      {/* `flex-wrap`, so a refusal from either control drops onto its own line. */}
      <div className="flex flex-wrap items-center gap-2">
        <TagList tags={idea.tags} max={1} />
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
