'use client'

import { cn } from '@collega/design-system'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Icon } from './icons'

/**
 * Comp R's drawer: fixed to the right and **over** the page, so the list or board beneath never
 * resizes or gains a scrollbar (`SPEC/20-feature-client-ui.md`, "List and detail pattern").
 *
 * Not modal — no scrim, no focus trap, the page stays usable. On open, focus moves to the heading;
 * on close it returns to `returnFocusTo`, or else to whatever had focus when it opened. Escape and ×
 * close it, unless something inside claimed the Escape first (a popover, the confirm dialog).
 *
 * Width is `--drawer` (`clamp(380px, 28vw, 520px)`) or `--drawer-wide`
 * (`clamp(720px, 62vw, 1100px)`), both full width below 900px. It stays mounted while closed so it
 * can slide out; `inert` and `visibility` take it out of the tab order and the accessibility tree
 * meanwhile.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  wide = false,
  footer,
  returnFocusTo,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** The small mono line above the title — "Ideas · New / Pending". */
  eyebrow?: ReactNode
  /** The create-with-assistant width. */
  wide?: boolean
  footer?: ReactNode
  returnFocusTo?: HTMLElement | null
  children: ReactNode
}) {
  const headingId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const openedFrom = useRef<HTMLElement | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  const returnTo = useRef(returnFocusTo)
  returnTo.current = returnFocusTo

  useEffect(() => {
    if (!open) return
    openedFrom.current = document.activeElement as HTMLElement | null
    heading.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) close.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const target = returnTo.current ?? openedFrom.current
      if (target?.isConnected) target.focus()
    }
  }, [open])

  return (
    <aside
      aria-labelledby={headingId}
      inert={!open}
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-[var(--drawer)] max-w-full flex-col border-l border-input bg-card text-card-foreground shadow-[-18px_0_40px_rgb(var(--shadow-rgb)/.16)]',
        'duration-200 ease-out motion-reduce:transition-none',
        wide && 'w-[var(--drawer-wide)]',
        // Visibility transitions only on the way out, so the drawer stays visible while it slides
        // away but is visible — and so focusable — the moment it opens.
        open
          ? 'visible translate-x-0 transition-[transform,width]'
          : 'invisible translate-x-[105%] transition-[transform,width,visibility]',
      )}
    >
      <div className="flex items-start gap-2 border-b px-[18px] pt-4 pb-2.5">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="font-mono text-[11px] tracking-wide text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="m-0 mt-0.5 text-[19px] leading-tight text-balance focus:outline-none"
          >
            {title}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto inline-grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-[18px] py-4">
        {children}
      </div>
      {footer ? (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-[18px] py-3">{footer}</div>
      ) : null}
    </aside>
  )
}
