'use client'

import { buttonVariants } from '@collega/design-system'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react'

/**
 * The one destructive modal (comp R): asks before Delete or Archive. `role="alertdialog"` on a
 * native modal `<dialog>`, so the page behind is inert; focus starts on **Cancel**, Tab and
 * Shift+Tab cycle between Cancel and the action only, and Escape cancels. Focus returns to whatever
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
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element || !open) return
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    cancel.current?.focus()
    return () => {
      element.close()
      if (opener?.isConnected) opener.focus()
      if (opener && document.activeElement === opener) return
      // Every desk screen has exactly one `<h1>` (PageHeader), so it is always there to land on.
      const heading = document.querySelector<HTMLElement>('h1')
      if (!heading) return
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
      heading.focus()
    }
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      // Also stops the native close, so `open` stays the caller's to change.
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Tab') {
      const first = cancel.current
      const last = confirm.current
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
