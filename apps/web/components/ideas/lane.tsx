'use client'

import { cn } from '@collega/design-system'
import { type DragEvent, useLayoutEffect, useRef } from 'react'
import { Icon } from '@/components/list/icons'
import type { Idea, Status } from '@/lib/types'
import { IdeaCard } from './idea-card'

const ARROW =
  'inline-flex size-6 items-center justify-center rounded-md border border-current/25 hover:bg-background/60 aria-disabled:cursor-not-allowed aria-disabled:opacity-40'

/**
 * How an Org Admin reorders lanes: drag a lane by its header onto another lane, or, from the
 * keyboard or a screen reader, the header's move left / move right. `null` hides them, which is every
 * other role's view (the row-actions exception to the Denied rule). `denialId` names the element
 * holding why they are refused — an archived board. Every refused arrow, the board's ends included,
 * is `aria-disabled` rather than `disabled`: a lane moved to an end would otherwise have the button
 * just pressed drop out of the tab order, and keyboard focus with it. While a save is `pending` the
 * arrows are `aria-disabled` too, and ignore a press. After a move the lane puts focus back on the
 * arrow that was pressed (see `Lane`). The header drags only when the arrows would work.
 * `onDragOver` answers whether a lane drag is under way, so a drop is accepted only for one.
 */
export type LaneReorder = {
  denialId: string | null
  pending: boolean
  onMove: (delta: -1 | 1) => void
  dragging: boolean
  over: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => boolean
  onDragLeave: () => void
  onDrop: () => void
}

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
  reorder = null,
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
  reorder?: LaneReorder | null
}) {
  const leftRef = useRef<HTMLButtonElement>(null)
  const rightRef = useRef<HTMLButtonElement>(null)
  const refocus = useRef<-1 | 1 | null>(null)

  // Lanes are keyed by status, so a move reorders DOM nodes rather than re-rendering them in place,
  // and React moves whichever node its list diff says is out of place - for a swap, the one that
  // went right. Moving a node that holds focus drops focus to <body>. The neighbours change in the
  // commit that moves the lane, and a layout effect runs after that DOM move and before paint, so
  // the pressed arrow gets focus back before anyone sees it gone. The flag stays up until the save
  // settles, so a refusal that moves the lane back is covered too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the neighbours are the trigger, not an input
  useLayoutEffect(() => {
    const target =
      refocus.current === -1 ? leftRef.current : refocus.current === 1 ? rightRef.current : null
    const active = document.activeElement
    if (target && (active === null || active === document.body)) target.focus()
  }, [previousStatusId, nextStatusId])

  const pending = reorder?.pending ?? false
  useLayoutEffect(() => {
    if (!pending) refocus.current = null
  }, [pending])

  const arrow = (delta: -1 | 1, end: boolean) => {
    const endId = `lane-${delta < 0 ? 'first' : 'last'}-${status.id}`
    const refusal = reorder?.denialId ?? (end ? endId : null)
    return (
      <>
        {end ? (
          <span id={endId} className="sr-only">
            Already the {delta < 0 ? 'first' : 'last'} lane.
          </span>
        ) : null}
        <button
          ref={delta < 0 ? leftRef : rightRef}
          type="button"
          className={ARROW}
          aria-disabled={refusal || pending ? 'true' : undefined}
          aria-describedby={refusal ?? undefined}
          aria-label={`Move the ${status.name} lane ${delta < 0 ? 'left' : 'right'}`}
          onClick={() => {
            // aria-disabled is advisory - the click still arrives, so the guard lives here.
            if (refusal || pending) return
            refocus.current = delta
            reorder?.onMove(delta)
          }}
        >
          <Icon name={delta < 0 ? 'prev' : 'next'} className="size-3.5" />
        </button>
      </>
    )
  }

  const draggable = reorder !== null && reorder.denialId === null && !pending

  return (
    <section
      aria-label={status.name}
      onDragOver={(event: DragEvent) => {
        if (reorder?.onDragOver()) event.preventDefault()
      }}
      onDragLeave={() => reorder?.onDragLeave()}
      onDrop={(event: DragEvent) => {
        if (!reorder) return
        event.preventDefault()
        reorder.onDrop()
      }}
      className={cn(
        'flex min-h-[min(62vh,560px)] min-w-0 flex-col gap-2 rounded-[14px] border border-border/70 bg-muted/55 px-1.5 pt-1.5 pb-3',
        reorder?.over && 'border-primary',
        reorder?.dragging && 'opacity-60',
      )}
    >
      {/* The status colour is data, so it tints the header through `color-mix` against the
          theme's own card and ink rather than standing alone as a raw fill. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dragging is the pointer path; the header's arrows are the keyboard and screen-reader one */}
      <div
        draggable={draggable}
        onDragStart={(event: DragEvent) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', status.id)
          reorder?.onDragStart()
        }}
        onDragEnd={() => reorder?.onDragEnd()}
        className={cn(
          'flex items-center gap-2 rounded-t-xl rounded-b-sm px-3 py-1.5 text-[13px] font-semibold',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
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
        {reorder ? (
          <span className="flex items-center gap-1">
            {arrow(-1, previousStatusId === null)}
            {arrow(1, nextStatusId === null)}
          </span>
        ) : null}
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
