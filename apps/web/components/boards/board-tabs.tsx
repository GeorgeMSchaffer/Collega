import { cn } from '@collega/design-system'
import Link from 'next/link'

export type BoardTab = 'board' | 'backlog' | 'sprints'

const LABELS: Record<BoardTab, string> = { board: 'Board', backlog: 'Backlog', sprints: 'Sprints' }

/**
 * Comp W's tabs on the board page. Plain links to `?tab=`, so each tab is a server render of its own
 * and the browser's back button means what it says; the current one is `aria-current="page"`.
 * `counts` puts the waiting number beside a tab, which the page reads fresh on every render.
 */
export function BoardTabs({
  boardId,
  tabs,
  active,
  counts,
}: {
  boardId: string
  tabs: readonly BoardTab[]
  active: BoardTab
  counts: Partial<Record<BoardTab, number>>
}) {
  return (
    <nav aria-label="Board sections" className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const count = counts[tab]
        const on = tab === active
        return (
          <Link
            key={tab}
            href={`/boards/${encodeURIComponent(boardId)}?tab=${tab}`}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-9 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              on && 'border-primary font-semibold text-foreground',
            )}
          >
            {LABELS[tab]}
            {count === undefined ? null : (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
