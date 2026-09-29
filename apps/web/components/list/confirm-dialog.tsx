'use client'

import { buttonVariants } from '@collega/design-system'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react'

/** Every desk screen has exactly one `<h1>` (PageHeader), so it is always there to land on. */
function focusHeading() {
  const heading = document.querySelector<HTMLElement>('h1')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
  heading.focus()
}

/**
 * Watches until focus moves off the opener by other means, or the opener leaves the page. Answers
 * `stop`, so an unmount or the next open can end the watch early.
 */
function focusHeadingIfOpenerLeaves(opener: HTMLElement): () => void {
  const stop = () => {
    observer.disconnect()
    document.removeEventListener('focusin', onFocusIn)
  }
  const onFocusIn = (event: FocusEvent) => {
    if (event.target !== opener) stop()
  }
  const observer = new MutationObserver(() => {
    if (opener.isConnected) return
    stop()
    if (document.activeElement === null || document.activeElement === document.body) focusHeading()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('focusin', onFocusIn)
  return stop
}

/**
 * The one destructive modal (comp R): asks before Delete or Archive. `role="alertdialog"` on a
 * native modal `<dialog>`, so the page behind is inert; focus starts on **Cancel**, Tab and
 * Shift+Tab cycle through the dialog's controls only, and Escape cancels. `children` holds any
 * choice the confirmation needs (a board save's "move them to" lane pickers), between the
 * description and the buttons, and joins the Tab cycle. Focus returns to whatever
 * opened it — or, when that has gone (the row it sat on was archived or deleted out of the list), to
 * the page's heading rather than dropping to `<body>`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = true,
  pending = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  /** A question: "Delete this idea?" */
  title: string
  /** What happens, in the reader's terms, including whether it can be undone. */
  description: ReactNode
  /** The action, named: "Delete idea", "Archive board". */
  confirmLabel: string
  /** `false` for a reversible action such as Archive, which takes the primary style instead. */
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const stopWatching = useRef<(() => void) | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element || !open) return
    stopWatching.current?.()
    stopWatching.current = null
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    cancel.current?.focus()
    return () => {
      element.close()
      if (opener?.isConnected) opener.focus()
      if (opener && document.activeElement === opener) {
        // The refreshed list usually arrives after the dialog has closed, so the row - and the
        // focused opener with it - can leave a render later.
        stopWatching.current = focusHeadingIfOpenerLeaves(opener)
      } else {
        focusHeading()
      }
    }
  }, [open])

  // Declared after the effect above so its cleanup runs last on unmount. A navigation removes the
  // opener without moving focus, and must not pull focus onto the next page's heading.
  useEffect(() => () => stopWatching.current?.(), [])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      // Also stops the native close, so `open` stays the caller's to change.
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Tab') {
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button, select, input') ?? []
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={onKeyDown}
      onCancel={(event) => event.preventDefault()}
      className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-lg border bg-card p-5 text-card-foreground shadow-[0_24px_60px_rgb(var(--shadow-rgb)/.3)] backdrop:bg-[rgb(var(--shadow-rgb)/.4)]"
    >
      <h2 id={titleId} className="m-0 text-lg">
        {title}
      </h2>
      <p id={descriptionId} className="m-0 mt-3 text-sm text-secondary-foreground">
        {description}
      </p>
      {children}
      <div className="mt-4 flex justify-end gap-2">
        <button
          ref={cancel}
          type="button"
          className={buttonVariants({ variant: 'outline' })}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          ref={confirm}
          type="button"
          className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
          onClick={pending ? undefined : onConfirm}
          aria-disabled={pending || undefined}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
