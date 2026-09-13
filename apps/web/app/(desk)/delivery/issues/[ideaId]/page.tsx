import { Alert, Avatar, Button, buttonVariants, Denied, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/nav/topbar'
import { getDeliveryStatus, getIssue, getOutcome, getSprint } from '@/lib/data'
import { EFFORT_COLORS } from '@/lib/display'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, deliveryAdminDenial } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ ideaId: string }> }) {
  // Metadata is its own render, so it establishes identity like any other segment that reads it —
  // `lib/server/current-user.ts` says why, and `loadPrincipal` is cached so this costs no request.
  // Without it the reader below reaches `organizationScope()` with no principal and the title alone
  // fails, quietly: the page still renders and the tab is left saying "Collega".
  await requireCurrentUser()

  const { ideaId } = await params
  const issue = await getIssue(ideaId)
  return { title: issue ? `${issue.title} · Collega` : 'Collega' }
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
 *
 * It is also why the segment is `[ideaId]` and the title carries no `CLG-` eyebrow: an Issue is not
 * a resource of its own, so it has no key of its own (`lib/types.ts`, `Issue`).
 */
export default async function IssuePage({ params }: { params: Promise<{ ideaId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { ideaId } = await params
  const issue = await getIssue(ideaId)
  if (!issue) notFound()

  const [status, sprint, outcome] = await Promise.all([
    getDeliveryStatus(issue.deliveryStatusId),
    getSprint(issue.sprintId),
    getOutcome(issue.outcomeId),
  ])

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
            <b className="font-medium text-foreground">{issue.title}</b>
          </span>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
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
                    {sprint.state === 'Active' ? (
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
              {deliveryAdminDenial(currentUser().role) ? (
                <Denied
                  reason={deliveryAdminDenial(currentUser().role) as string}
                  id="why-set-outcome"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    aria-disabled="true"
                    aria-describedby="why-set-outcome"
                  >
                    Set outcome
                  </Button>
                </Denied>
              ) : (
                <Link
                  href={`/delivery/issues/${issue.id}/outcome`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Set outcome
                </Link>
              )}
            </div>
          </div>
        </div>

        <Alert variant="note" className="max-w-2xl">
          <span>
            Everything above is read. Moving this issue is{' '}
            <code className="font-mono text-xs">PUT /ideas/&#123;id&#125;/delivery-status</code> and
            changing its sprint is{' '}
            <code className="font-mono text-xs">PUT /ideas/&#123;id&#125;/sprint</code> &mdash; both
            live, neither wired to a control yet. Setting the outcome has no endpoint at all: that
            is Slice 2, and the picker reflects it.
          </span>
        </Alert>
      </main>
    </>
  )
}
