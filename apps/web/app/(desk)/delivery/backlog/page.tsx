import { Avatar, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import { AdminAction } from '@/components/delivery/admin-action'
import { Topbar } from '@/components/nav/topbar'
import { getBacklogIssues, getDeliveryStatuses, getOutcomes, getSprints } from '@/lib/data'
import { EFFORT_COLORS } from '@/lib/display'

export const metadata = { title: 'Backlog · Collega' }

export default async function BacklogPage() {
  const [rows, sprints, outcomes, statuses] = await Promise.all([
    getBacklogIssues(),
    getSprints(),
    getOutcomes(),
    getDeliveryStatuses(),
  ])
  const next = sprints.find((sprint) => !sprint.active)

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <b className="font-medium text-foreground">Backlog</b>
          </span>
        }
        actions={next ? <AdminAction id="why-start" label={`Start ${next.name}`} /> : undefined}
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>Backlog</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            Issues that are committed but not yet in a sprint, most upvoted first &mdash; so the
            list reads as the organization&rsquo;s own priority order. Assigning a sprint moves the
            row; it is still the same idea, still carrying its history.
          </p>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Issue
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Outcome
                  </th>
                  <th scope="col" className="w-36 px-4 py-2.5 font-medium">
                    Effort
                  </th>
                  <th scope="col" className="w-32 px-4 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="w-24 px-4 py-2.5 font-medium">
                    Assignee
                  </th>
                  <th scope="col" className="w-28 px-4 py-2.5 text-right font-medium">
                    Votes
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((issue) => {
                  const outcome = outcomes.find((row) => row.id === issue.outcomeId)
                  const status = statuses.find((row) => row.id === issue.deliveryStatusId)
                  return (
                    <tr key={issue.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/delivery/issues/${issue.key}`}>{issue.title}</Link>
                        <div className="font-mono text-xs text-muted-foreground">{issue.key}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {outcome ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Dot color={outcome.color} />
                            {outcome.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ungrouped</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Marker>
                          <Dot color={EFFORT_COLORS[issue.effort]} />
                          {issue.effort}
                        </Marker>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{status?.name}</td>
                      <td className="px-4 py-2.5">
                        {issue.assigneeInitials ? (
                          <Avatar
                            initials={issue.assigneeInitials}
                            className="size-6 text-[10px]"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {issue.upvotesAtPromotion}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {rows.length} issues in the backlog. Vote counts are the snapshot taken at promotion.
          </div>
        </div>
      </main>
    </>
  )
}
