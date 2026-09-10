import { type ReactNode, Suspense } from 'react'
import { navGroupsWithoutCounts } from '@/components/nav/nav-items'
import { Sidebar } from '@/components/nav/sidebar'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { requireCurrentUser } from '@/lib/server/current-user'
import { SessionProvider } from '@/lib/session-client'

/**
 * The desk shell (comp Q `.shell`): a fixed 256px sidebar and a scrolling content column.
 *
 * It resolves identity for **its own** subtree — the sidebar — and hands the principal across to
 * the client half through `SessionProvider`, which is how `sidebar-nav.tsx` reads a role without
 * awaiting anything.
 *
 * It is deliberately **not** the only place identity is resolved. A layout and its page render
 * concurrently, so the page can read identity while this line is still awaiting and what it
 * establishes is not there yet — each page calls `requireCurrentUser()` too, and the request-cached
 * resolver keeps that one round trip rather than two. `lib/server/current-user.ts` has the full
 * reasoning, and the measurement behind it.
 *
 * **E3–E6 must not edit this file** — they render into it. Comp P's third column, the docked
 * inspector (`.shell.insp`), belongs to E4 and is deliberately absent until then.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()

  return (
    <SessionProvider user={user}>
      <div className="grid min-h-screen grid-cols-[256px_minmax(0,1fr)]">
        {/* Suspense here is load-bearing, not decoration. `Sidebar` awaits its counts, and an
            un-suspended await in a layout blocks the whole response: nothing flushes, so no page's
            own loading.tsx can ever render and the reader watches a blank document for the length of
            the slowest query. The fallback is the real nav minus its counts, because every label and
            href is static — the sidebar is usable immediately and the numbers arrive after. */}
        <Suspense fallback={<SidebarNav groups={navGroupsWithoutCounts} />}>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-col">{children}</div>
      </div>
    </SessionProvider>
  )
}
