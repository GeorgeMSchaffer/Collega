import { Dot, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { AdminAction } from '@/components/delivery/admin-action'
import { Topbar } from '@/components/nav/topbar'
import { getDeliveryStatuses, getIssues, getIssuesForOutcome, getOutcomes } from '@/lib/data'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Roadmap · Collega' }

/**
 * Outcomes, and the issues serving each.
 *
 * Every figure here is a **plain count**, and that is only true because an issue sits under at most
 * one outcome. Under the rejected multi-parent design each row would be a cover rather than a count
 * and the rows would not add up — which is why the ungrouped row exists: an outcome is optional, so
 * without it the totals would silently fail to close.
 */
export default async function RoadmapPage() {
  const [outcomes, issues, statuses] = await Promise.all([
    getOutcomes(),
    getIssues(),
    getDeliveryStatuses(),
  ])
  const grouped = await Promise.all(
    outcomes.map(async (outcome) => ({ outcome, items: await getIssuesForOutcome(outcome.id) })),
  )
  const ungrouped = issues.filter((issue) => issue.outcomeId === null)
  const accountedFor = grouped.reduce((n, g) => n + g.items.length, 0) + ungrouped.length

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <b className="font-medium text-foreground">Roadmap</b>
          </span>
        }
        actions={<AdminAction id="why-outcome" label="Add outcome" />}
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>Roadmap</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            What the quarter is for. Each outcome groups the issues that serve it; an issue sits
            under one outcome, so every count here is a plain count and the rows add up to the
            delivery set.
          </p>
        </div>

        {outcomes.length === 0 ? (
          <EmptyState
            heading="No outcomes yet"
            action={<AdminAction id="why-outcome-empty" label="Add the first outcome" />}
          >
            An outcome is a named, dated theme &mdash; &ldquo;cut reporting effort&rdquo; &mdash;
            that issues are grouped under. {currentUser.organizationName ?? 'This deployment'} has{' '}
            {issues.length} delivery {issues.length === 1 ? 'issue' : 'issues'} and nothing to group
            them by.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {grouped.map(({ outcome, items }) => (
                <div key={outcome.id} className="rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
                    <Dot color={outcome.color} />
                    <span className="font-semibold">{outcome.name}</span>
                    <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                      {outcome.quarter}
                    </span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {items.length} {items.length === 1 ? 'issue' : 'issues'}
                    </span>
                  </div>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {items.map((issue) => (
                      <li
                        key={issue.id}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-5 py-2.5 text-sm last:border-0"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                        <Link href={`/delivery/issues/${issue.key}`}>{issue.title}</Link>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {statuses.find((row) => row.id === issue.deliveryStatusId)?.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {ungrouped.length > 0 ? (
                <div className="rounded-lg border border-dashed bg-card px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-muted-foreground">Not yet grouped</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {ungrouped.length} issues
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    An outcome is optional, so these are counted here rather than left out &mdash;
                    the total below would not otherwise close.
                  </p>
                </div>
              ) : null}
            </div>

            <p className="m-0 text-xs text-muted-foreground">
              {accountedFor} of {issues.length} issues accounted for across {outcomes.length}{' '}
              outcomes.
            </p>
          </>
        )}
      </main>
    </>
  )
}
