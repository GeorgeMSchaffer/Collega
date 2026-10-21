'use client'

import { Button, cn, Input } from '@collega/design-system'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { Icon } from '@/components/list/icons'
import { setBlockers } from '@/lib/server/idea-actions'
import type { IdeaBlockers, IdeaDetail } from '@/lib/types'
import { ParentChip, WARN_BADGE } from './idea-badges'

type Item = Pick<IdeaDetail, 'id' | 'boardId' | 'blockedBy'>

const CYCLE_REASON = 'It is already waiting on this item, so adding it would make a loop.'

/**
 * The drawer's Blockers section (comp U screen 6): chips with × and a picker, saving at once
 * through `PUT /ideas/{id}/blocked-by`, which replaces the whole set — so each change sends the
 * current ids with the one difference. Hidden for anyone who may not edit when there is nothing to
 * show; chips alone, with no × or Add, when they are there.
 *
 * What is shown always comes from the props, which the action's revalidation refreshes, so a
 * refused save leaves the chips as they were and says why beside the control.
 */
export function BlockersSection({
  item,
  blockers,
  canEdit,
}: {
  item: Item
  blockers: IdeaBlockers
  canEdit: boolean
}) {
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const heading = useRef<HTMLHeadingElement>(null)
  const addWrap = useRef<HTMLSpanElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Where focus goes once a save settles: a disabled button drops it to the body.
  const refocus = useRef<{ remove: string } | 'removed' | 'added' | null>(null)
  const id = useId()

  const current = item.blockedBy
  const open = current.filter((blocker) => !blocker.isFinal).length

  // A removed chip takes its × with it, so focus goes to Add, or the heading when Add is not there.
  useEffect(() => {
    const target = refocus.current
    if (!target || pending) return
    refocus.current = null
    if (target === 'added') document.getElementById(`${id}-q`)?.focus()
    else if (target === 'removed')
      (addWrap.current?.querySelector('button') ?? heading.current)?.focus()
    else listRef.current?.querySelector<HTMLElement>(`[data-remove="${target.remove}"]`)?.focus()
  }, [pending, id])

  if (!canEdit && current.length === 0) return null

  function save(ids: string[], removing: string | null) {
    start(async () => {
      setError(null)
      const result = await setBlockers(item.id, item.boardId ?? '', ids)
      if (result.error) setError(result.error)
      refocus.current = removing ? (result.error ? { remove: removing } : 'removed') : 'added'
    })
  }

  const ids = current.map((blocker) => blocker.ideaId)
  const needle = query.trim().toLowerCase()
  const shown = blockers.candidates.filter(
    (card) =>
      needle === '' ||
      card.title.toLowerCase().includes(needle) ||
      (card.itemKey ?? '').toLowerCase().includes(needle),
  )

  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3
          ref={heading}
          tabIndex={-1}
          id={`${id}-h`}
          className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Blockers
        </h3>
        {canEdit ? (
          <span className="font-mono text-xs text-muted-foreground">saves on its own</span>
        ) : null}
      </div>

      <div ref={listRef} className="flex flex-wrap items-center gap-1.5">
        {current.map((blocker) => {
          const card = blockers.cards[blocker.ideaId]
          const label = [blocker.itemKey, card?.title, card?.statusName].filter(Boolean).join(' · ')
          return (
            <span
              key={blocker.ideaId}
              className={cn(
                blocker.isFinal
                  ? 'inline-flex max-w-full items-center gap-1.5 rounded-sm bg-success/12 px-2 text-xs font-semibold text-success'
                  : WARN_BADGE,
                'max-w-full py-0.5 font-mono text-[11.5px] font-medium [overflow-wrap:anywhere]',
                canEdit && 'pr-0.5',
              )}
            >
              <Icon name={blocker.isFinal ? 'check' : 'lock'} className="size-3 shrink-0" />
              {label || 'Another task'}
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove blocker ${blocker.itemKey ?? card?.title ?? ''}`.trim()}
                  data-remove={blocker.ideaId}
                  onClick={() =>
                    save(
                      ids.filter((other) => other !== blocker.ideaId),
                      blocker.ideaId,
                    )
                  }
                  className="inline-grid size-5 shrink-0 place-items-center rounded hover:bg-foreground/10 disabled:opacity-50"
                >
                  <Icon name="x" className="size-3" />
                </button>
              ) : null}
            </span>
          )
        })}
        {canEdit ? (
          <span ref={addWrap} className="contents">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-expanded={picking}
              aria-controls={`${id}-picker`}
              onClick={() => setPicking((value) => !value)}
            >
              <Icon name="plus" />
              Add blocker
            </Button>
          </span>
        ) : null}
      </div>

      {current.length > 0 ? (
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          {open === 0
            ? 'Every blocker is final, so nothing holds this item.'
            : `${open} open ${open === 1 ? 'blocker' : 'blockers'}. It can leave its first lane once every blocker is final.`}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 mt-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      {canEdit && picking ? (
        <section
          id={`${id}-picker`}
          aria-label="Add blocker"
          className="mt-2 flex flex-col gap-2 rounded-md border p-3"
        >
          <label htmlFor={`${id}-q`} className="text-xs font-semibold">
            Blocked by
          </label>
          <Input
            id={`${id}-q`}
            value={query}
            placeholder="Search cards on this board"
            aria-describedby={`${id}-hint`}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span id={`${id}-hint`} className="text-xs text-muted-foreground">
            Cards on this board. Tasks of other ideas and standalone cards are listed.
          </span>
          {shown.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">No cards match.</p>
          ) : (
            <ul className="m-0 max-h-64 list-none divide-y overflow-y-auto rounded-md border p-0">
              {shown.map((card) => {
                const added = ids.includes(card.id)
                return (
                  <li
                    key={card.id}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm',
                      card.cycle && !added && 'opacity-75',
                    )}
                  >
                    <span className="min-w-0">
                      {card.itemKey ? (
                        <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                          {card.itemKey}
                        </span>
                      ) : null}
                      {card.title}
                      {card.parentItemKey ? (
                        <ParentChip itemKey={card.parentItemKey} className="ml-1.5" />
                      ) : null}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {card.statusName}
                      </span>
                    </span>
                    {added ? (
                      <span className="font-mono text-xs text-muted-foreground">Added</span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || card.cycle}
                        aria-label={`Add blocker ${card.itemKey ?? card.title}`}
                        aria-describedby={card.cycle ? `${id}-why-${card.id}` : undefined}
                        onClick={() => save([...ids, card.id], null)}
                      >
                        Add
                      </Button>
                    )}
                    {card.cycle && !added ? (
                      <span
                        id={`${id}-why-${card.id}`}
                        className="col-span-2 text-xs text-muted-foreground"
                      >
                        {CYCLE_REASON}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}
    </section>
  )
}
