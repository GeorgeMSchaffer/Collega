'use client'

import { Avatar } from '@collega/design-system'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/server/auth-actions'
import { useCurrentUser } from '@/lib/session-client'
import { CommandPalette } from './command-palette'
import { NavIcon } from './icons'
import type { NavGroup } from './nav-items'

const NAV_CLASS =
  'flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground'

/**
 * The sidebar's rendering. A client component because the active item comes from `usePathname`,
 * which is why `groups` arrives already counted — see `./sidebar.tsx`.
 */
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()
  // The principal the desk layout already resolved, handed across the boundary by
  // `SessionProvider` — not a second fetch, and not a promise this component could not await.
  const user = useCurrentUser()

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
      <div className="flex items-center gap-2 px-2 py-3 text-base font-semibold text-foreground">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
          CG
        </span>
        <b>Collega</b>
      </div>

      {/* A Site Admin is outside every organization, so it shows the scope rather than an org name. */}
      <div className="px-2 pb-3 text-xs font-medium text-muted-foreground">
        {user.organizationName ?? 'All organizations'}
      </div>

      <CommandPalette />

      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
            {group.label}
          </div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={NAV_CLASS}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <NavIcon icon={item.icon} />
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {item.count}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}

      <div className="flex-1" />

      {/* Sign out sits on its own row rather than beside the name: at 256px the two together
          truncated the display name, and a person's name is the one label here that must not be. */}
      <div className="flex flex-col gap-1 border-t px-2 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <Avatar initials={user.initials} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-snug">{user.displayName}</div>
            <div className="text-xs text-muted-foreground/70">{user.roleLabel}</div>
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
    </aside>
  )
}
