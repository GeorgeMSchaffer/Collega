import { Alert, Avatar, buttonVariants, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/nav/topbar'
import { deliveryStatusById, EFFORT_COLORS, issueByKey, outcomeById, sprintById } from '@/lib/mock'

export async function generateMetadata({ params }: { params: Promise<{ issueKey: string }> }) {
  const { issueKey } = await params
  const issue = issueByKey(issueKey)
  return { title: issue ? `${issue.key} ${issue.title} · Collega` : 'Collega' }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 py-1.5 text-sm">{children}</dd>
    </>
  )
}

/**
 * One issue's delivery view.
 *
 * The issue **is** the idea it was promoted from — same record, same history — which is why the
 * provenance row shows the upvote count captured at promotion rather than a live one. That snapshot
 * answers "how much support did this have when we committed", and a live count could not.
 */
export default async function IssuePage({ params }: { params: Promise<{ issueKey: string }> }) {
  const { issueKey } = await params
  const issue = issueByKey(issueKey)
  if (!issue) notFound()

  const status = deliveryStatusById(issue.deliveryStatusId)
  const sprint = sprintById(issue.sprintId)
  const outcome = outcomeById(issue.outcomeId)

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery /{' '}
            {sprint ? (
              <>
                <Link href="/delivery/sprint">{sprint.name}</Link> /{' '}
              </>
            ) : (
              <>
                <Link href="/delivery/backlog">Backlog</Link> /{' '}
              </>
            )}
            <b className="font-medium text-foreground">{issue.key}</b>
          </span>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {issue.key}
            </span>
            <Marker>
              <Dot color={status?.color} />
              {status?.name}
            </Marker>
            <Marker>
              <Dot color={EFFORT_COLORS[issue.effort]} />
              {issue.effort} effort
            </Marker>
          </div>
          <h1>{issue.title}</h1>
        </div>

        <div className="max-w-2xl rounded-lg border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="m-0 text-base font-semibold">Delivery</h2>
          </div>
          <div className="px-5 py-4">
            <dl className="m-0 grid grid-cols-[128px_minmax(0,1fr)] items-baseline gap-x-4">
              <Row label="Status">
                <Marker>
                  <Dot color={status?.color} />
                  {status?.name}
                </Marker>
              </Row>
              <Row label="Sprint">
                {sprint ? (
                  <span className="inline-flex items-center gap-2">
                    {sprint.name}
                    {sprint.active ? (
                      <Marker>
                        <Dot color="var(--green)" />
                        Active
                      </Marker>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Backlog &mdash; not in a sprint</span>
                )}
              </Row>
              <Row label="Outcome">
                {outcome ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Dot color={outcome.color} />
                    {outcome.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not grouped</span>
                )}
              </Row>
              <Row label="Assignee">
                {issue.assigneeInitials ? (
                  <Avatar initials={issue.assigneeInitials} className="size-6 text-[10px]" />
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </Row>
              <Row label="Support">
                <span className="tabular-nums">
                  {issue.upvotesAtPromotion} upvotes at promotion
                </span>
              </Row>
            </dl>

            <div className="mt-4">
              <Link
                href={`/delivery/issues/${issue.key}/outcome`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Set outcome
              </Link>
            </div>
          </div>
        </div>

        <Alert variant="note" className="max-w-2xl">
          <span>
            Moving this issue, assigning it, or changing its sprint needs{' '}
            <code className="font-mono text-xs">PATCH /issues/&#123;key&#125;</code>, which arrives
            with Wave D. Setting the outcome is the one flow built here, and it is also read-only
            until then.
          </span>
        </Alert>
      </main>
    </>
  )
}
