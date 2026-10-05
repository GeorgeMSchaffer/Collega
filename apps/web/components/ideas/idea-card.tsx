import { cn, EffortBar } from '@collega/design-system'
import type { DragEvent } from 'react'
import { Icon } from '@/components/list/icons'
import type { Idea } from '@/lib/types'
import { CardActions } from './card-actions'
import { People, PriorityMarker, TagList } from './idea-chips'

/** A card drag's payload type; a lane header's drag carries `text/plain`, so the two never mix. */
const CARD_DRAG_TYPE = 'application/x-collega-idea'

/**
 * A card in a lane (comp R `.kcard`): the title, which opens the drawer, then priority and
 * assignees, the effort bar when the idea has an effort, then the first tag beside the upvote and
 * move controls.
 *
 * **The card itself never drags; its handle does.** The handle shows under the arrows' own rule
 * (`canMove`), and the drag image is the whole card so it reads as the card being carried. A
 * draggable card would swallow clicks on the title, the upvote and the arrows.
 *
 * **The title is the card's keyboard focus target.** With it focused, ← → move the card one lane;
 * the arrows act only there, so the card's other controls keep their own keys.
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
  dragging = false,
  onDragStart,
  onDragEnd,
  onKeyMove,
}: {
  idea: Idea
  boardId: string
  previousStatusId: string | null
  nextStatusId: string | null
  canMove: boolean
  upvoteDenial: string | null
  selected: boolean
  onOpen: (trigger: HTMLButtonElement) => void
  dragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  /** ← → on the focused title: the lane to move to. Absent where the card may not move. */
  onKeyMove?: ((statusId: string) => void) | undefined
}) {
  return (
    <div
      data-idea-card
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-[10px] border bg-card p-2.5 text-foreground hover:border-primary',
        selected && 'outline-2 -outline-offset-1 outline-primary',
        dragging && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-1.5">
        {canMove ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: dragging is the pointer path; the card's arrows are the keyboard and screen-reader one
          <span
            role="img"
            aria-label={`Drag ${idea.title} to another lane`}
            title="Drag to another lane"
            draggable
            onDragStart={(event: DragEvent<HTMLSpanElement>) => {
              const card = event.currentTarget.closest('[data-idea-card]')
              if (card) event.dataTransfer.setDragImage(card, 16, 16)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData(CARD_DRAG_TYPE, idea.id)
              onDragStart?.()
            }}
            onDragEnd={() => onDragEnd?.()}
            className="-ml-1 mt-px inline-flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
          >
            <Icon name="grip" className="size-4" />
          </span>
        ) : null}
        <button
          type="button"
          data-idea-title={idea.id}
          onClick={(event) => onOpen(event.currentTarget)}
          onKeyDown={(event) => {
            if (!canMove || !onKeyMove) return
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            // At the board's ends there is no lane that way, and the key does nothing.
            const target = event.key === 'ArrowLeft' ? previousStatusId : nextStatusId
            if (target && !event.repeat) onKeyMove(target)
          }}
          className="text-left text-[13px] leading-snug font-semibold hover:text-accent-foreground hover:underline"
        >
          {idea.title}
        </button>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <PriorityMarker priority={idea.priority} />
        <People people={idea.assignees} quiet />
      </div>
      {idea.effort ? <EffortBar effort={idea.effort} /> : null}
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
