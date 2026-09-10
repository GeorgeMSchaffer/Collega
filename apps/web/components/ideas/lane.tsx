import { Dot } from '@collega/design-system'
import type { Idea, Status } from '@/lib/data'
import { IdeaCard } from './idea-card'

/**
 * One swimlane, and the cards in it.
 *
 * The lane knows what is either side of it and the card does not, which is why the neighbouring
 * status ids arrive here rather than being worked out per card: "one lane left" is a fact about the
 * board's order, and computing it thirty times from the same array would be thirty chances to
 * disagree with the columns actually on screen.
 */
export function Lane({
  status,
  ideas,
  boardId,
  previousStatusId,
  nextStatusId,
  canMove,
  upvoteDenial,
}: {
  status: Status
  ideas: Idea[]
  boardId: string
  previousStatusId: string | null
  nextStatusId: string | null
  canMove: boolean
  upvoteDenial: string | null
}) {
  return (
    <div className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2">
      <div className="flex items-center gap-2 px-2 pt-1 pb-2">
        <Dot color={status.color} />
        <span className="font-medium">{status.name}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{ideas.length}</span>
      </div>
      {ideas.length === 0 ? (
        <div className="mb-1.5 rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
          No ideas
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
          />
        ))
      )}
    </div>
  )
}
