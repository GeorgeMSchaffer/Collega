import { cn } from '@collega/design-system'
import Link from 'next/link'
import type { TaskTab } from '@/lib/data/tasks'

const LABELS: Record<TaskTab, string> = {
  backlog: 'Backlog',
  mine: 'My tasks',
  sprint: 'In sprint',
  all: 'All',
}

/** The Tasks page's tabs: plain links to `?tab=`, the current one `aria-current="page"`. */
export function TasksTabs({ active, backlogCount }: { active: TaskTab; backlogCount: number }) {
  return (
    <nav aria-label="Task views" className="flex gap-1 overflow-x-auto border-b">
      {(Object.keys(LABELS) as TaskTab[]).map((tab) => {
        const on = tab === active
        return (
          <Link
            key={tab}
            href={`/tasks?tab=${tab}`}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-9 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              on && 'border-primary font-semibold text-foreground',
            )}
          >
            {LABELS[tab]}
            {tab === 'backlog' ? (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {backlogCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
