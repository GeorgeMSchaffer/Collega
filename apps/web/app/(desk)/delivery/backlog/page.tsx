import { Alert, Avatar, buttonVariants, Dot, EffortBar, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { AdminAction } from '@/components/delivery/admin-action'
import { AddIssueButton, BacklogAdd, RowEditButton } from '@/components/delivery/backlog-add'
import { IssueDrawer } from '@/components/delivery/issue-drawer'
import { loadIssueDrawer } from '@/components/delivery/load-issue-drawer'
import { Topbar } from '@/components/nav/topbar'
import {
  getBacklogIssues,
  getDeliveryStatuses,
  getIdeaFormOptions,
  getOutcomes,
  getSprints,
} from '@/lib/data'
import { issueAddDenial, mayEditIdeaContent } from '@/lib/roles'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Backlog · Collega' }

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  const user = await requireCurrentUser()
  const addDenial = issueAddDenial(user.role)

  const query = await searchParams
  // The create drawer's catalogs are read only when it is asked for, and only for a role that may
  // use it: a refused add opens nothing rather than a form whose save would be refused.
  const adding = query.new !== undefined && addDenial === null

  const [rows, sprints, outcomes, statuses, formOptions] = await Promise.all([
    getBacklogIssues(),
    getSprints(),
    getOutcomes(),
    getDeliveryStatuses(),
    adding ? getIdeaFormOptions() : null,
  ])
  const { drawer, editing, missing } = await loadIssueDrawer(query, rows)
  // The next sprint is a `Planned` one, not merely "not the active one": a `Completed` sprint is
  // also not active, and offering to start one that has already run is worse than offering nothing.
  const next = sprints.find((sprint) => sprint.state === 'Planned')

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
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title="Backlog"
          description={
            <>
              Issues that are committed but not yet in a sprint, most upvoted first &mdash; so the
              list reads as the organization&rsquo;s own priority order. Assigning a sprint moves
              the row; it is still the same idea, still carrying its history.
            </>
          }
          action={
            <GatedAction id="why-add-issue" label="Add New Issue" denial={addDenial}>
              <AddIssueButton />
            </GatedAction>
          }
        />

        {missing ? (
          <Alert variant="note" role="status">
            <span>
              That issue could not be opened. It may have been returned to discovery or deleted.
            </span>
          </Alert>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            heading="Nothing waiting"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <GatedAction id="why-add-issue-empty" label="Add issue" denial={addDenial}>
                  <AddIssueButton label="Add issue" />
                </GatedAction>
                <Link href="/boards" className={buttonVariants({ variant: 'outline' })}>
                  Open the ideas board
                </Link>
              </div>
            }
          >
            Every committed issue is in a sprint. New issues arrive here when an idea is promoted
            from a board or when one is added here.
          </EmptyState>
        ) : (
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
                    <th scope="col" className="w-20 px-4 py-2.5 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((issue) => {
                    const outcome = outcomes.find((row) => row.id === issue.outcomeId)
                    const status = statuses.find((row) => row.id === issue.deliveryStatusId)
                    return (
                      <tr
                        key={issue.id}
                        data-issue-id={issue.id}
                        aria-current={drawer?.issue.id === issue.id ? 'true' : undefined}
                        className="border-b last:border-0 aria-[current]:bg-accent/50 data-[added]:bg-accent"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/delivery/backlog?idea=${encodeURIComponent(issue.id)}` as Route}
                            scroll={false}
                            className="font-semibold hover:underline"
                          >
                            {issue.title}
                          </Link>
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
                          <EffortBar effort={issue.effort} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{status?.name}</td>
                        <td className="px-4 py-2.5">
                          {issue.assigneeInitials ? (
                            <Avatar initials={issue.assigneeInitials} className="size-6 text-xs" />
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {issue.upvotesAtPromotion}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {mayEditIdeaContent(user.role, user.userId, issue.authorUserId) ? (
                            <RowEditButton ideaId={issue.id} title={issue.title} />
                          ) : null}
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
        )}
      </main>
      <BacklogAdd
        options={formOptions}
        sprints={sprints.filter((sprint) => sprint.state !== 'Completed')}
        rowIds={rows.map((row) => row.id).join(',')}
      />
      <IssueDrawer data={drawer} editing={editing} />
    </>
  )
}
