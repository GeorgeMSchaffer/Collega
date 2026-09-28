import type { Idea, Status } from '@/lib/types'
import { IdeaCard } from './idea-card'

/**
 * One swimlane (comp R `.lane`): a quiet full-height column with a soft ground and hairline border,
 * headed in its status's own colour, so a board reads as lanes rather than loose cards.
 *
 * The lane knows what is either side of it and the card does not, which is why the neighbouring
 * status ids arrive here: "one lane left" is a fact about the board's order.
 */
export function Lane({
  status,
  ideas,
  boardId,
  previousStatusId,
  nextStatusId,
  canMove,
  upvoteDenial,
  selectedId,
  onOpen,
}: {
  status: Status
  ideas: Idea[]
  boardId: string
  previousStatusId: string | null
  nextStatusId: string | null
  canMove: boolean
  upvoteDenial: string | null
  selectedId: string | null
  onOpen: (ideaId: string, trigger: HTMLButtonElement) => void
}) {
  return (
    <section
      aria-label={status.name}
      className="flex min-h-[min(62vh,560px)] min-w-0 flex-col gap-2 rounded-[14px] border border-border/70 bg-muted/55 px-1.5 pt-1.5 pb-3"
    >
      {/* The status colour is data, so it tints the header through `color-mix` against the
          theme's own card and ink rather than standing alone as a raw fill. */}
      <div
        className="flex items-center gap-2 rounded-t-xl rounded-b-sm px-3 py-1.5 text-[13px] font-semibold"
        style={{
          background: `color-mix(in srgb, ${status.color} 14%, var(--card))`,
          color: `color-mix(in srgb, ${status.color} 55%, var(--foreground))`,
        }}
      >
        <span className="flex-1">{status.name}</span>
        <span className="font-mono text-xs font-medium opacity-80">
          {ideas.length}
          <span className="sr-only"> ideas</span>
        </span>
      </div>
      {ideas.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-input p-3.5 text-center text-xs text-muted-foreground">
          Nothing here yet
        </div>
      ) : (
        ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            boardId={boardId}
            previousStatusId={previousStatusId}
            nextStatusId={nextStatusId}
            canMove={canMove}
            upvoteDenial={upvoteDenial}
            selected={idea.id === selectedId}
            onOpen={(trigger) => onOpen(idea.id, trigger)}
          />
        ))
      )}
    </section>
  )
}
