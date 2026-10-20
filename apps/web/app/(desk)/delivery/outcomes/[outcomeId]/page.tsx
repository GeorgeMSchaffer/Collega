import { Dot, EffortBar, EmptyState, Meta } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OutcomeStateText } from '@/components/delivery/outcome-state'
import { Topbar } from '@/components/nav/topbar'
import { getMemberOptions, getOutcomeDetail, getStatuses } from '@/lib/data'
import { formatDay, formatMetric, formatWindow, metricShare } from '@/lib/outcome-display'
import { requireCurrentUser } from '@/lib/server/current-user'
import type { OutcomeIdea, OutcomeWithIdeas } from '@/lib/types'

export async function generateMetadata({ params }: { params: Promise<{ outcomeId: string }> }) {
  // Identity here too, for the reason the issue page's own `generateMetadata` gives.
  await requireCurrentUser()

  const { outcomeId } = await params
  const outcome = await getOutcomeDetail(outcomeId)
  return { title: outcome ? `${outcome.name} · Collega` : 'Collega' }
}

function Stat({
  label,
  children,
  note,
}: {
  label: string
  children: React.ReactNode
  note?: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
      <dt>
        <Meta caps>{label}</Meta>
      </dt>
      <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{children}</dd>
      {note ? <small className="text-xs text-muted-foreground">{note}</small> : null}
    </div>
  )
}

function Of({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-muted-foreground"> of {children}</span>
}

/** What an item holds for the metric types this Outcome totals; types it has no value for are left out. */
function realizedText(idea: OutcomeIdea, outcome: OutcomeWithIdeas): string {
  const parts = idea.metrics.flatMap((metric) => {
    const total = outcome.metricTotals.find((row) => row.metricTypeId === metric.metricTypeId)
    if (!total || metric.realized === null) return []
    return [formatMetric(metric.realized, total.unit)]
  })
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/**
 * One Outcome (comp S, "Outcome rollup"): its window and owner, the rollup, the projected and
 * realized totals per metric type, and the items grouped under it with a status filter.
 *
 * Read-only. The contract returns no per-item task counts, so the comp's Tasks column is not drawn.
 */
export default async function OutcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ outcomeId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [{ outcomeId }, query] = await Promise.all([params, searchParams])
  const outcome = await getOutcomeDetail(outcomeId)
  if (!outcome) notFound()

  const [statuses, members] = await Promise.all([getStatuses(), getMemberOptions()])
  const statusOf = new Map(statuses.map((status) => [status.id, status]))
  const owner = members.find((member) => member.id === outcome.ownerUserId)
  const names = new Map(members.map((member) => [member.id, member.name]))

  // Only statuses the items actually hold, in the catalog's order.
  const held = new Set(outcome.ideas.map((idea) => idea.statusId))
  const filters = statuses.filter((status) => held.has(status.id))
  const picked = typeof query.status === 'string' ? query.status : null
  const filter = filters.find((status) => status.id === picked) ?? null
  const shown = filter ? outcome.ideas.filter((idea) => idea.statusId === filter.id) : outcome.ideas

  const href = (id: string | null) =>
    (id ? `?status=${encodeURIComponent(id)}` : `/delivery/outcomes/${outcome.id}`) as Route
  const tab = (active: boolean) =>
    `rounded-sm px-3 py-1 text-xs no-underline hover:text-foreground ${active ? 'bg-card font-semibold text-foreground shadow-xs' : 'text-muted-foreground'}`

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <Link href="/delivery/roadmap">Roadmap</Link> /{' '}
            <b className="font-medium text-foreground">{outcome.name}</b>
          </span>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <div className="min-w-0">
          <h1 className="m-0 flex items-center gap-2.5">
            <Dot color={outcome.color} className="size-3" />
            <span className="min-w-0 break-words">{outcome.name}</span>
          </h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            {outcome.description ?? 'No description yet.'}
          </p>
          <dl className="m-0 mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Window</dt>
              <dd className="m-0">
                {formatWindow(outcome.targetStartDate, outcome.targetEndDate)}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">State</dt>
              <dd className="m-0">
                <OutcomeStateText start={outcome.targetStartDate} end={outcome.targetEndDate} />
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="m-0">
                {outcome.ownerUserId === null
                  ? 'No owner'
                  : (owner?.name ?? 'Owner no longer active')}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Sprints</dt>
              <dd className="m-0">
                {outcome.sprintStart && outcome.sprintEnd
                  ? formatWindow(outcome.sprintStart, outcome.sprintEnd)
                  : 'None yet'}
              </dd>
            </div>
          </dl>
        </div>

        <dl className="m-0 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-4">
          {outcome.metricTotals.map((total) => {
            const share = metricShare(total)
            return (
              <Stat
                key={total.metricTypeId}
                label={total.name}
                note={
                  share === null ? 'projected and realized' : `${share}% of projected, realized`
                }
              >
                {formatMetric(total.realized, total.unit)}
                <Of>{formatMetric(total.projected, total.unit)}</Of>
              </Stat>
            )
          })}
          <Stat
            label="Ideas"
            note={`${outcome.doneIdeaCount} done · ${outcome.ideaCount - outcome.doneIdeaCount} open`}
          >
            {outcome.ideaCount}
          </Stat>
          <Stat label="Tasks" note={`${outcome.taskCount - outcome.doneTaskCount} not done`}>
            {outcome.doneTaskCount}
            <Of>{outcome.taskCount}</Of>
          </Stat>
        </dl>

        <section aria-labelledby="outcome-ideas" className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <h2 id="outcome-ideas" className="m-0 text-base">
              Ideas in this outcome
            </h2>
            {filters.length > 1 ? (
              <nav
                aria-label="Filter by status"
                className="ml-auto inline-flex max-w-full flex-wrap rounded-md bg-muted p-0.5"
              >
                <Link
                  href={href(null)}
                  aria-current={filter ? undefined : 'true'}
                  className={tab(filter === null)}
                >
                  All
                </Link>
                {filters.map((status) => (
                  <Link
                    key={status.id}
                    href={href(status.id)}
                    aria-current={filter?.id === status.id ? 'true' : undefined}
                    className={tab(filter?.id === status.id)}
                  >
                    {status.name}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          {outcome.ideas.length === 0 ? (
            <div className="border-t p-4">
              <EmptyState heading="No ideas grouped here yet">
                Items grouped under this outcome are listed here.
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Key</th>
                    <th className="px-4 py-2 font-medium">Idea</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Effort</th>
                    <th className="px-4 py-2 font-medium">Sprint</th>
                    <th className="px-4 py-2 font-medium">Realized</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((idea) => {
                    const status = statusOf.get(idea.statusId)
                    return (
                      <tr key={idea.id} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                          {idea.itemKey ?? ''}
                        </td>
                        <td className="px-4 py-2 font-semibold">
                          <Link href={`/ideas/${idea.id}`} className="no-underline hover:underline">
                            {idea.title}
                          </Link>
                          {idea.assigneeUserIds.length > 0 ? (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {idea.assigneeUserIds
                                .map((id) => names.get(id) ?? 'Unknown')
                                .join(', ')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Dot color={status?.color} />
                            {status?.name ?? 'Unknown status'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {idea.effort ? (
                            <EffortBar effort={idea.effort} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                          {idea.sprintStart && idea.sprintEnd
                            ? `${formatDay(idea.sprintStart)} – ${formatDay(idea.sprintEnd)}`
                            : 'No sprint'}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                          {realizedText(idea, outcome)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
