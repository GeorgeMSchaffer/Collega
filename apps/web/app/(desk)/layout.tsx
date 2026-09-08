import { type ReactNode, Suspense } from 'react'
import { navGroupsWithoutCounts } from '@/components/nav/nav-items'
import { Sidebar } from '@/components/nav/sidebar'
import { SidebarNav } from '@/components/nav/sidebar-nav'

/**
 * The desk shell (comp Q `.shell`): a fixed 256px sidebar and a scrolling content column.
 *
 * **E3–E6 must not edit this file** — they render into it. Comp P's third column, the docked
 * inspector (`.shell.insp`), belongs to E4 and is deliberately absent until then.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
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
  )
}
