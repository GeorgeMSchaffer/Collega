'use client'

import { Alert, cn } from '@collega/design-system'
import {
  type DragEvent,
  type ReactNode,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'
import { Icon } from '@/components/list/icons'

export type ReorderableRow = {
  id: string
  /** What the row's controls and announcements call it. */
  label: string
  /** The row's own `<td>`s; the grip and move buttons are added in front. */
  cells: ReactNode
}

const BUTTON =
  'inline-flex size-6 items-center justify-center rounded-md border border-input hover:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-40'

/**
 * The `<tbody>` of a grid whose rows can be put in order (opt-in; pair it with `ReorderTh`).
 *
 * A row drags only from its grip, so a link or button in it never starts a drag. From the keyboard
 * or a screen reader each row has move up / move down buttons: they are `aria-disabled` rather than
 * `disabled` at either end and while a save is in flight, so focus is never lost with the button
 * just pressed, and focus returns to it after a move. `onReorder` receives the complete new order,
 * once per drop or move; the order shows at once and falls back on a refusal, whose message is
 * shown. A polite live region announces the new position.
 */
export function ReorderableBody({
  rows,
  columns,
  onReorder,
}: {
  rows: ReorderableRow[]
  /** Table columns, for the row that carries the refusal. */
  columns: number
  onReorder: (orderedIds: string[]) => Promise<{ error: string | null }>
}) {
  // The order as last saved, or as the save in flight has it. A refusal ends the transition with
  // `rows` unchanged, so the order falls back on its own; a save revalidates and `rows` arrives new.
  const [ordered, setOrdered] = useOptimistic(rows)
  const [error, setError] = useState<string | null>(null)
  const [news, setNews] = useState('')
  const [saving, startSave] = useTransition()

  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const refocus = useRef<string | null>(null)

  // Moving a DOM node that holds focus drops focus to <body>; the order is the trigger, and a
  // layout effect runs after that move and before paint. The target stays until the save settles,
  // so a refusal that moves the row back is covered too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the order is the trigger, not an input
  useLayoutEffect(() => {
    const active = document.activeElement
    const target = refocus.current ? buttons.current.get(refocus.current) : undefined
    if (target && (active === null || active === document.body)) target.focus()
  }, [ordered])
  useLayoutEffect(() => {
    if (!saving) refocus.current = null
  }, [saving])

  const move = (from: number, to: number) => {
    if (saving || from === to) return
    const next = [...ordered]
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    setNews('')
    startSave(async () => {
      setOrdered(next)
      const result = await onReorder(next.map((row) => row.id))
      setError(result.error)
      if (!result.error) setNews(`${moved.label} moved to position ${to + 1} of ${next.length}`)
    })
  }

  const endDrag = () => {
    setDragging(null)
    setOver(null)
  }

  const draggingIndex = dragging === null ? -1 : ordered.findIndex((row) => row.id === dragging)

  return (
    <tbody aria-busy={saving || undefined}>
      {ordered.map((row, index) => {
        const first = index === 0
        const last = index === ordered.length - 1
        const button = (delta: -1 | 1, end: boolean) => {
          const key = `${row.id}:${delta}`
          const endId = `row-${delta < 0 ? 'first' : 'last'}-${row.id}`
          return (
            <>
              {end ? (
                <span id={endId} className="sr-only">
                  Already the {delta < 0 ? 'first' : 'last'} row.
                </span>
              ) : null}
              <button
                ref={(node) => {
                  if (node) buttons.current.set(key, node)
                  else buttons.current.delete(key)
                }}
                type="button"
                className={BUTTON}
                aria-disabled={end || saving ? 'true' : undefined}
                aria-describedby={end ? endId : undefined}
                aria-label={`Move ${row.label} ${delta < 0 ? 'up' : 'down'}`}
                onClick={() => {
                  // aria-disabled is advisory - the click still arrives, so the guard lives here.
                  if (end || saving) return
                  refocus.current = key
                  move(index, index + delta)
                }}
              >
                <Icon name={delta < 0 ? 'asc' : 'desc'} className="size-3.5" />
              </button>
            </>
          )
        }

        const isOver = over === row.id && dragging !== null && dragging !== row.id
        return (
          <tr
            key={row.id}
            onDragOver={(event: DragEvent) => {
              if (dragging === null) return
              event.preventDefault()
              if (over !== row.id) setOver(row.id)
            }}
            onDrop={(event: DragEvent) => {
              if (dragging === null) return
              event.preventDefault()
              if (draggingIndex >= 0) move(draggingIndex, index)
              endDrag()
            }}
            className={cn(
              !last && 'border-b',
              dragging === row.id && 'opacity-50',
              // The line sits on the side the row will land: below when moving down, above when up.
              isOver &&
                (draggingIndex < index
                  ? '[&>td]:shadow-[inset_0_-2px_0_0_var(--primary)]'
                  : '[&>td]:shadow-[inset_0_2px_0_0_var(--primary)]'),
            )}
          >
            <td className="px-4 py-2.5">
              <span className="flex items-center gap-1">
                {/* biome-ignore lint/a11y/noStaticElementInteractions: dragging is the pointer path; the move buttons are the keyboard and screen-reader one */}
                <span
                  draggable={!saving}
                  title={`Drag to reorder ${row.label}`}
                  onDragStart={(event: DragEvent<HTMLSpanElement>) => {
                    const rowElement = event.currentTarget.closest('tr')
                    if (rowElement) event.dataTransfer.setDragImage(rowElement, 0, 0)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', row.id)
                    setDragging(row.id)
                  }}
                  onDragEnd={endDrag}
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground',
                    !saving && 'cursor-grab active:cursor-grabbing',
                  )}
                >
                  <Icon name="grip" className="size-4" />
                </span>
                {button(-1, first)}
                {button(1, last)}
              </span>
            </td>
            {row.cells}
          </tr>
        )
      })}
      <tr className="border-0">
        <td colSpan={columns + 1} className="p-0">
          <div role="status" aria-live="polite" className="sr-only">
            {news}
          </div>
          {error ? (
            <Alert variant="destructive" className="m-3">
              <span>{error}</span>
            </Alert>
          ) : null}
        </td>
      </tr>
    </tbody>
  )
}
