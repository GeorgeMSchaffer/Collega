import { buttonVariants, Dot, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { AdminAction } from '@/components/delivery/admin-action'
import { IssueCard } from '@/components/delivery/issue-card'
import { Topbar } from '@/components/nav/topbar'
import {
  getActiveSprint,
  getBacklogIssues,
  getDeliveryStatuses,
  getIssuesInSprint,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Sprint board · Collega' }

export default async function SprintBoardPage() {
  // Identity first, and in this segment: Next renders a layout and its page independently,
  // so the desk layout resolving it is not enough for what renders here. One `/auth/me` per
  // request all the same — the resolver is request-cached.
  await requireCurrentUser()

  const [sprint, deliveryStatuses] = await Promise.all([getActiveSprint(), getDeliveryStatuses()])
  const committed = sprint ? await getIssuesInSprint(sprint.id) : []
  // The empty state names how many issues are waiting. Derived from the same query the backlog
  // page runs rather than quoted from comp Q, so the two screens cannot disagree.
  const waiting = sprint ? [] : await getBacklogIssues()

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
          <EmptyState
            heading="No sprint is running"
            action={
              <div className="flex flex-col items-start gap-2">
                <AdminAction id="why-plan-empty" label="Plan a sprint" />
                <Link href="/delivery/backlog" className={buttonVariants({ variant: 'outline' })}>
                  See the backlog
                </Link>
              </div>
            }
          >
            {currentUser().organizationName ?? 'This deployment'} has {waiting.length}{' '}
            {waiting.length === 1 ? 'issue' : 'issues'} in the delivery backlog and no active
            sprint. An administrator plans a sprint from the backlog, then starts it here.
          </EmptyState>
        )}
      </main>
    </>
  )
}
