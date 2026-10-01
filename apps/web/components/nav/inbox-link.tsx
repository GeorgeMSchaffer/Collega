'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NavIcon } from './icons'
import { INBOX_HREF } from './nav-items'

const REFRESH_MS = 60_000

/**
 * The sidebar's Inbox item and its unread badge (`20-feature-idea-following.md` rule 40).
 *
 * There is no push channel on serverless, so the count is asked for: on every navigation and every
 * minute while the tab is visible. The layout that renders the sidebar is kept across navigations,
 * so the server's count alone would go stale; `initialUnread` is that count, and a mark-read action
 * that revalidates the layout hands down a fresh one.
 *
 * The badge is an ink pill, never a hue (rule 43) — the rail's own ink, so it holds on a dark rail.
 */
export function InboxLink({
  className,
  initialUnread,
}: {
  className: string
  /** Undefined while the sidebar's counts are still loading. */
  initialUnread: number | undefined
}) {
  const pathname = usePathname()
  const [unread, setUnread] = useState(initialUnread ?? 0)

  useEffect(() => {
    if (initialUnread !== undefined) setUnread(initialUnread)
  }, [initialUnread])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the pathname is the trigger, not an input
  useEffect(() => {
    void refreshUnread(setUnread)
  }, [pathname])

  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread(setUnread)
    }, REFRESH_MS)
    return () => clearInterval(tick)
  }, [])

  return (
    <Link
      href={INBOX_HREF}
      className={className}
      aria-current={pathname === INBOX_HREF ? 'page' : undefined}
      aria-label={unread > 0 ? `Inbox, ${unread} unread` : undefined}
    >
      <NavIcon icon="inbox" />
      Inbox
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="ml-auto h-5 min-w-5 rounded-full bg-sidebar-accent-foreground px-1.5 text-center text-[11px] leading-5 font-bold text-sidebar tabular-nums"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  )
}

/** A failed refresh keeps the last count: the next navigation or tick asks again. */
async function refreshUnread(set: (count: number) => void): Promise<void> {
  try {
    const response = await fetch('/inbox/unread-count', { cache: 'no-store' })
    if (!response.ok) return
    const body = (await response.json()) as { unreadCount: number }
    set(body.unreadCount)
  } catch {
    // Offline, or the session ended mid-request; the idle sign-out owns the second case.
  }
}
