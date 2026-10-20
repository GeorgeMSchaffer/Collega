'use client'

import { Avatar, cn } from '@collega/design-system'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from '@/lib/server/auth-actions'
import { useCurrentUser } from '@/lib/session-client'
import { CommandPalette } from './command-palette'
import { NavIcon } from './icons'
import { InboxLink } from './inbox-link'
import { INBOX_HREF, type NavGroup, navItemVisible } from './nav-items'

const NAV_CLASS =
  'flex w-full items-center gap-2 rounded-md p-2 max-md:w-auto text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground'

/**
 * The sidebar's rendering. A client component because the active item comes from `usePathname`,
 * which is why `groups` arrives already counted — see `./sidebar.tsx`.
 */
export function SidebarNav({
  groups,
  unread,
}: {
  groups: NavGroup[]
  /** The inbox's unread count as the server rendered it; undefined while the counts load. */
  unread?: { count: number; at: number }
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a navigation closes the phone menu
  useEffect(() => setOpen(false), [pathname])
  // The principal the desk layout already resolved, handed across the boundary by
  // `SessionProvider` — not a second fetch, and not a promise this component could not await.
  const user = useCurrentUser()

  // Below md the rail becomes a compact top bar (comp S): the brand and a menu button, with the
  // links, search and Sign out behind the button. Group labels and the name card drop out.
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground max-md:w-full max-md:flex-row max-md:flex-wrap max-md:items-center max-md:border-r-0 max-md:border-b">
      {/* Sidebar tokens only in here: one theme (Piazza Sera) gives the rail a dark ground. */}
      <div className="flex items-center gap-2 px-2 py-3 text-base font-semibold text-sidebar-accent-foreground max-md:flex-1">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          CG
        </span>
        <b>Collega</b>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((current) => !current)}
          className="ml-auto hidden size-8 items-center justify-center rounded-md text-lg hover:bg-sidebar-accent max-md:inline-flex"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      <div id="primary-nav" className={cn('contents', !open && 'max-md:hidden')}>
        {/* A Site Admin is outside every organization, so it shows the scope rather than an org name. */}
        <div className="px-2 pb-3 text-xs font-medium text-sidebar-foreground/75 max-md:hidden">
          {user.organizationName ?? 'All organizations'}
        </div>

        <CommandPalette />

        {groups.map((group) => {
          const items = group.items.filter((item) => navItemVisible(item, user.role))
          // A group with nothing to offer this role (Delivery, for a Site Admin) loses its heading too.
          if (items.length === 0) return null
          return (
            <div key={group.label} className="max-md:contents">
              <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70 max-md:hidden">
                {group.label}
              </div>
              {items.map((item) =>
                item.href === INBOX_HREF ? (
                  <InboxLink key={item.href} className={NAV_CLASS} initialUnread={unread} />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={NAV_CLASS}
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    <NavIcon icon={item.icon} />
                    {item.label}
                    {item.count !== undefined ? (
                      <span className="ml-auto text-xs tabular-nums opacity-75">{item.count}</span>
                    ) : null}
                  </Link>
                ),
              )}
            </div>
          )
        })}

        <div className="flex-1 max-md:hidden" />

        {/* Sign out sits on its own row rather than beside the name: at 256px the two together
          truncated the display name, and a person's name is the one label here that must not be. */}
        <div className="flex flex-col gap-1 border-t border-sidebar-border px-2 py-2.5 text-sm max-md:border-t-0 max-md:p-0">
          <div className="flex items-center gap-2 max-md:hidden">
            <Avatar initials={user.initials} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-snug">{user.displayName}</div>
              <div className="text-xs text-sidebar-foreground/75">{user.roleLabel}</div>
            </div>
          </div>
          {/* A real `<form>` around a Server Function, so signing out is a POST and cannot be
            triggered by a prefetch or a link the browser decides to warm up. */}
          <form action={signOut}>
            <button type="submit" className={`${NAV_CLASS} cursor-pointer border-0 bg-transparent`}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
