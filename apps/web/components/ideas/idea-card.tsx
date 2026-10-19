import { cn, EffortBar } from '@collega/design-system'
import type { DragEvent } from 'react'
import { Icon } from '@/components/list/icons'
import type { Idea } from '@/lib/types'
import { CardActions } from './card-actions'
import { People, PriorityMarker, TagList } from './idea-chips'

/** A card drag's payload type; a lane header's drag carries `text/plain`, so the two never mix. */
const CARD_DRAG_TYPE = 'application/x-collega-idea'

/**
 * What Board References adds to a card, decided by the board from the card's facts and its lanes
 * (`lib/board-work.ts`). `lockText` set means the card waits on open tasks: it has no drag handle
 * and its arrows are refused with that text. `blockedText` set means a task still in its board's
 * first lane with an open blocker: dashed, dimmed, and held there the same way.
 */
export type CardWork = {
  lockText: string | null
  /** "1 of 4 tasks" on a card in a lane that references a board; null elsewhere. */
  rollup: string | null
  progress: number
  blockedText: string | null
  blockedTip: string | null
  /** Why the arrow that way is refused, or null when it works. */
  previousRefusal: string | null
  nextRefusal: string | null
  openTasks: number
  blockers: number
  /** An Org Admin's way past the lock; null for everyone else, and when nothing holds the card. */
  onMoveAnyway: (() => void) | null
}

/** A card with nothing Board References about it. */
export const PLAIN_CARD: CardWork = {
  lockText: null,
  rollup: null,
  progress: 0,
  blockedText: null,
  blockedTip: null,
  previousRefusal: null,
  nextRefusal: null,
  openTasks: 0,
  blockers: 0,
  onMoveAnyway: null,
}

const WARN_BADGE =
  'inline-flex w-fit items-center gap-1.5 rounded-sm bg-warning/12 px-2 text-xs font-semibold text-warning'

/**
 * A card in a lane (comp R `.kcard`): the title, which opens the drawer, then priority and
 * assignees, the task progress and lock or blocked badge where Board References gives it one
 * (comp U screens 2 and 3), the effort bar when the idea has an effort, the item key with the
 * rollup, then the first tag beside the upvote and move controls.
 *
 * **The card itself never drags; its handle does.** The handle shows under the arrows' own rule
 * (`canMove`), and the drag image is the whole card so it reads as the card being carried. A
 * draggable card would swallow clicks on the title, the upvote and the arrows. A card held by the
 * lock or a blocker has no handle: a lock stands in its place and says why.
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
  work = PLAIN_CARD,
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
  work?: CardWork
  selected: boolean
  onOpen: (trigger: HTMLButtonElement) => void
  dragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  /** ← → on the focused title: the lane to move to. Absent where the card may not move. */
  onKeyMove?: ((statusId: string) => void) | undefined
}) {
  const held = work.lockText ?? work.blockedTip
  return (
    <div
      data-idea-card
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-[10px] border bg-card p-2.5 text-foreground hover:border-primary',
        selected && 'outline-2 -outline-offset-1 outline-primary',
        dragging && 'opacity-50',
        work.blockedText && 'border-dashed opacity-70',
      )}
    >
      <div className="flex items-start gap-1.5">
        {canMove && held ? (
          <span
            role="img"
            aria-label={held}
            title={held}
            className="-ml-1 mt-px inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground"
          >
            <Icon name="lock" className="size-3.5" />
          </span>
        ) : canMove ? (
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
          className="text-left text-xs leading-snug font-semibold hover:text-accent-foreground hover:underline"
        >
          {idea.title}
        </button>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        {idea.priority ? <PriorityMarker priority={idea.priority} /> : <span />}
        <People people={idea.assignees} quiet />
      </div>
      {work.rollup !== null ? (
        <span aria-hidden="true" className="block h-[5px] overflow-hidden rounded-[3px] bg-muted">
          <span className="block h-full bg-success" style={{ width: `${work.progress}%` }} />
        </span>
      ) : null}
      {work.lockText ? (
        <span className={cn(WARN_BADGE, 'py-px text-[11.5px]')}>
          <Icon name="lock" className="size-3" />
          {work.lockText}
        </span>
      ) : null}
      {work.blockedText ? (
        <span
          title={work.blockedTip ?? undefined}
          className={cn(WARN_BADGE, 'px-1.5 font-mono text-[10.5px] leading-[17px] font-medium')}
        >
          <Icon name="lock" className="size-3" />
          {work.blockedText}
        </span>
      ) : null}
      {idea.effort ? <EffortBar effort={idea.effort} /> : null}
      {idea.itemKey || work.rollup ? (
        <span className="font-mono text-[11px] font-medium text-muted-foreground">
          {[idea.itemKey, work.rollup].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      {/* `flex-wrap`, so a refusal from either control drops onto its own line. */}
      <div className="flex flex-wrap items-center gap-2">
        <TagList tags={idea.tags} max={1} />
        <span className="flex-1" />
        {work.onMoveAnyway ? (
          <button
            type="button"
            onClick={work.onMoveAnyway}
            aria-label={`Move anyway: ${idea.title}`}
            className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-destructive hover:bg-accent"
          >
            Move anyway…
          </button>
        ) : null}
        <CardActions
          idea={idea}
          boardId={boardId}
          previousStatusId={previousStatusId}
          nextStatusId={nextStatusId}
          canMove={canMove}
          upvoteDenial={upvoteDenial}
          previousRefusal={work.previousRefusal}
          nextRefusal={work.nextRefusal}
          openTasks={work.openTasks}
          blockers={work.blockers}
        />
      </div>
    </div>
  )
}
