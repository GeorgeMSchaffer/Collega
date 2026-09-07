import { Avatar, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import { EFFORT_COLORS, type Issue, outcomeById } from '@/lib/mock'

export function IssueCard({ issue }: { issue: Issue }) {
  const outcome = outcomeById(issue.outcomeId)

  return (
    <div className="mb-1.5 rounded-xl border bg-card p-3 shadow-sm hover:shadow-md">
      <div className="mb-1 font-mono text-[0.68rem] text-muted-foreground">{issue.key}</div>
      <Link href={`/delivery/issues/${issue.key}`} className="font-medium">
        {issue.title}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <Marker>
          <Dot color={EFFORT_COLORS[issue.effort]} />
          {issue.effort} effort
        </Marker>
        <span className="flex-1" />
        {issue.assigneeInitials ? (
          <Avatar initials={issue.assigneeInitials} className="size-5 text-[9px]" />
        ) : null}
      </div>
      {outcome ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Dot color={outcome.color} />
          {outcome.name}
        </div>
      ) : null}
    </div>
  )
}
