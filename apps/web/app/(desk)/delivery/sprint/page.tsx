import { Dot } from '@collega/design-system'
import Link from 'next/link'
import { AdminAction } from '@/components/delivery/admin-action'
import { IssueCard } from '@/components/delivery/issue-card'
import { Topbar } from '@/components/nav/topbar'
import { activeSprint, deliveryStatuses, issuesInSprint } from '@/lib/mock'

export const metadata = { title: 'Sprint board · Collega' }

export default function SprintBoardPage() {
  const sprint = activeSprint
  const committed = sprint ? issuesInSprint(sprint.id) : []

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <b className="font-medium text-foreground">Sprint board</b>
          </span>
        }
        actions={
          <>
            <AdminAction id="why-plan" label="Plan next sprint" />
            {sprint ? <AdminAction id="why-complete" label="Complete sprint" /> : null}
          </>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>Sprint board</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            Issues committed to the running sprint, in five fixed delivery statuses. Only the person
            who raised it, an assignee, or an administrator can move one — and moving needs{' '}
            <code className="font-mono text-xs">PATCH /issues/&#123;key&#125;</code>, which arrives
            with Wave D.
          </p>
        </div>

        {sprint ? (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{sprint.name}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    <Dot color="var(--green)" />
                    Active
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  Goal &mdash; {sprint.goal}
                </div>
              </div>
              <div className="text-sm tabular-nums text-muted-foreground">
                {sprint.startsOn} &ndash; {sprint.endsOn}
              </div>
              <div className="text-sm tabular-nums text-muted-foreground">
                {committed.length} issues
              </div>
            </div>

            <div className="flex items-start gap-3 overflow-x-auto pb-3">
              {deliveryStatuses.map((status) => {
                const inLane = committed.filter((issue) => issue.deliveryStatusId === status.id)
                return (
                  <div key={status.id} className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2">
                    <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                      <Dot color={status.color} />
                      <span className="font-medium">{status.name}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {inLane.length}
                      </span>
                    </div>
                    {inLane.length === 0 ? (
                      <div className="mb-1.5 rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
                        No issues
                      </div>
                    ) : (
                      inLane.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8">
            <h3 className="m-0 text-base font-semibold">No sprint is running</h3>
            <p className="m-0 max-w-prose text-sm text-muted-foreground">
              An administrator plans a sprint from the backlog, then starts it here.
            </p>
            <AdminAction id="why-plan-empty" label="Plan a sprint" />
            <Link href="/delivery/backlog">See the backlog</Link>
          </div>
        )}
      </main>
    </>
  )
}
