import type { ReactNode } from 'react'
import { Sidebar } from '@/components/nav/sidebar'

/**
 * The desk shell (comp Q `.shell`): a fixed 256px sidebar and a scrolling content column.
 *
 * **E3–E6 must not edit this file** — they render into it. Comp P's third column, the docked
 * inspector (`.shell.insp`), belongs to E4 and is deliberately absent until then.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[256px_minmax(0,1fr)]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  )
}
