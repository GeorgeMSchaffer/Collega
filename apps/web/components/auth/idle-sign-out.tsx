'use client'

import { buttonVariants } from '@collega/design-system'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { signOut } from '@/lib/server/auth-actions'
import {
  loginHref,
  publishSessionSignal,
  type SessionEndNotice,
  subscribeSessionSignal,
} from '@/lib/session-signal'

export type Clock = { now: () => number }

const systemClock: Clock = { now: () => Date.now() }

/** Requirement 38: thirty minutes without activity, warned two minutes before. */
export const IDLE_TIMEOUT_MS = 30 * 60_000
export const IDLE_WARNING_MS = 2 * 60_000

const TICK_MS = 1000
/** Scrolling fires dozens of events a second; the other tabs need to hear about it once. */
const PUBLISH_EVERY_MS = 1000

/** Requirement 39's activity. `scroll` does not bubble, so every listener captures. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const

function replaceLocation(href: string): void {
  window.location.replace(href)
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * The browser idle deadline (`SPEC/20-feature-auth.md` requirements 38–42), mounted once by the
 * desk layout.
 *
 * Every tab keeps the time of the last activity it knows of — its own, or another tab's through
 * `lib/session-signal.ts` — and checks it once a second: from two minutes before the deadline it
 * shows the warning, and at the deadline it sends the reader to `/login?expired=1`, where
 * `proxy.ts` drops the session cookie. That is the same path a session the API refuses already
 * takes, so idle expiry needs no sign-out of its own. The login page then tells every other tab
 * (`SessionEndedSignal`), which covers an explicit sign-out and a password change as well.
 *
 * **Nothing here touches the JWT** (requirement 40). Staying signed in resets this browser's idle
 * clock only; the token's absolute lifetime is the API's, and `sessionRemainingMs` is how this
 * component learns it, so that reaching it also lands on the expired notice rather than on a bare
 * sign-in form the next time the reader clicks something.
 *
 * Activity inside the open warning does not count: every click and key there is a press of one of
 * its two buttons, and dismissing the warning on the way to "Sign out" would make that button
 * unreachable. "Stay signed in" (or Escape, which dismisses the warning the same way) is how this
 * tab says it is still here; activity in another tab dismisses it too.
 *
 * `clock` and `navigate` are injectable so the deadline can be tested without real time passing.
 */
export function IdleSignOut({
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  sessionRemainingMs = null,
  clock = systemClock,
  navigate = replaceLocation,
}: {
  timeoutMs?: number
  warningMs?: number
  /** Time left on the session token when the page was rendered; `null` when it is not known. */
  sessionRemainingMs?: number | null
  clock?: Clock
  navigate?: (href: string) => void
}) {
  /** Milliseconds until the idle deadline while the warning is showing; `null` otherwise. */
  const [remaining, setRemaining] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const stay = useRef<HTMLButtonElement>(null)
  const staySignedIn = useRef<() => void>(() => {})
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const mountedAt = clock.now()
    // Relative to this browser's own clock, so a clock that disagrees with the server's cannot
    // move the absolute deadline.
    const absoluteDeadline = sessionRemainingMs === null ? null : mountedAt + sessionRemainingMs
    let lastActivity = mountedAt
    let lastPublished = Number.NEGATIVE_INFINITY
    let ended = false

    const end = (notice: SessionEndNotice) => {
      if (ended) return
      ended = true
      navigate(loginHref(notice))
    }

    /** Ends the session if a deadline has passed, else shows or hides the warning. */
    const check = (): boolean => {
      const now = clock.now()
      const idle = now - lastActivity
      if (idle >= timeoutMs || (absoluteDeadline !== null && now >= absoluteDeadline)) {
        end('expired')
        return true
      }
      setRemaining(idle >= timeoutMs - warningMs ? timeoutMs - idle : null)
      return false
    }

    const record = (publishNow: boolean) => {
      // Activity after the deadline is too late: a laptop opened an hour later reports visibility
      // before the next tick, and must not revive a session that has already lapsed.
      if (ended || check()) return
      const now = clock.now()
      lastActivity = now
      setRemaining(null)
      if (publishNow || now - lastPublished >= PUBLISH_EVERY_MS) {
        lastPublished = now
        publishSessionSignal({ type: 'activity', at: now })
      }
    }
    staySignedIn.current = () => record(true)

    // Loading a signed-in page is itself activity, and tells the tabs already open.
    publishSessionSignal({ type: 'activity', at: mountedAt })
    lastPublished = mountedAt

    const onActivity = (event: Event) => {
      const warning = dialog.current
      if (warning?.open && event.target instanceof Node && warning.contains(event.target)) return
      record(false)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') record(false)
    }
    const unsubscribe = subscribeSessionSignal((signal) => {
      if (signal.type === 'ended') {
        end(signal.notice)
      } else if (signal.at > lastActivity) {
        lastActivity = signal.at
        check()
      }
    })

    for (const type of ACTIVITY_EVENTS) {
      document.addEventListener(type, onActivity, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const tick = setInterval(check, TICK_MS)
    check()

    return () => {
      clearInterval(tick)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      for (const type of ACTIVITY_EVENTS) {
        document.removeEventListener(type, onActivity, { capture: true })
      }
    }
  }, [clock, navigate, timeoutMs, warningMs, sessionRemainingMs])

  const showing = remaining !== null

  useEffect(() => {
    const element = dialog.current
    if (!element || !showing) return
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    stay.current?.focus()
    return () => {
      element.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [showing])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      // Claimed, so the drawer or inspector underneath does not close on the same key.
      event.preventDefault()
      staySignedIn.current()
    } else if (event.key === 'Tab') {
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button') ?? []
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

  const seconds = remaining === null ? 0 : Math.ceil(remaining / 1000)
  // Announced every thirty seconds rather than every second, which would talk over everything else.
  const announced = Math.ceil(seconds / 30) * 30

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={onKeyDown}
      onCancel={(event) => event.preventDefault()}
      className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-lg border bg-card p-5 text-card-foreground shadow-[0_24px_60px_rgb(var(--shadow-rgb)/.3)] backdrop:bg-[rgb(var(--shadow-rgb)/.4)]"
    >
      {showing ? (
        <>
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Still there?
          </p>
          <h2 id={titleId} className="m-0 mt-1 text-lg">
            Your session is about to expire
          </h2>
          <p id={descriptionId} className="m-0 mt-3 text-sm text-secondary-foreground">
            You will be signed out in{' '}
            <strong className="tabular-nums">{formatSeconds(seconds)}</strong> due to inactivity.
          </p>
          <p className="sr-only" aria-live="polite">
            Signing out in {formatSeconds(announced)}.
          </p>
          <p className="m-0 mt-3 text-xs text-muted-foreground">
            Any click, key, scroll or touch counts as activity, in this tab or another. Staying
            signed in resets the idle clock; it does not extend the eight-hour limit on a session.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            {/* A real form around the Server Function, as in the sidebar: an explicit sign-out,
                so it lands on the sign-in form without the expired notice (requirement 42). */}
            <form action={signOut}>
              <button type="submit" className={buttonVariants({ variant: 'outline' })}>
                Sign out
              </button>
            </form>
            <button
              ref={stay}
              type="button"
              className={buttonVariants()}
              onClick={() => staySignedIn.current()}
            >
              Stay signed in
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  )
}
