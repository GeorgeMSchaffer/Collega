import { Alert, Button, buttonVariants, Denied, Dot } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { InertForm } from '@/components/common/inert-form'
import { CloseOnEscape } from '@/components/inspector/close-on-escape'
import { Topbar } from '@/components/nav/topbar'
import { getIssueByKey, getIssuesForOutcome, getOutcome, getOutcomes } from '@/lib/data'
import { EFFORT_COLORS } from '@/lib/display'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, deliveryAdminDenial } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ issueKey: string }> }) {
  const { issueKey } = await params
  const issue = await getIssueByKey(issueKey)
  return { title: issue ? `Set outcome · ${issue.key} · Collega` : 'Collega' }
}

/**
 * Choosing the outcome an issue serves.
 *
 * **A radio group, not a checkbox list** — and that is the whole difference from the rejected
 * multi-parent design (`SPEC/decisions.md` 2026-09-02, single-parent). A checkbox list would make
 * this an *add*, and an add is what turns every roadmap total from a count into a cover. Picking
 * another outcome moves the issue; it never joins a second.
 *
 * Docked as a third column rather than a drawer, like the idea inspector: nothing is covered,
 * nothing needs `inert`, there is no focus trap, and Escape closes.
 */
export default async function SetOutcomePage({
  params,
}: {
  params: Promise<{ issueKey: string }>
}) {
  // Identity first, and in this segment: Next renders a layout and its page independently,
  // so the desk layout resolving it is not enough for what renders here. One `/auth/me` per
  // request all the same — the resolver is request-cached.
  await requireCurrentUser()

  const { issueKey } = await params
  const issue = await getIssueByKey(issueKey)
  if (!issue) notFound()

  const [current, outcomes] = await Promise.all([getOutcome(issue.outcomeId), getOutcomes()])
  // The per-outcome counts beside each radio; read together so they are one round trip apiece
  // rather than one after another.
  const counts = new Map(
    await Promise.all(
      outcomes.map(
        async (outcome) =>
          [outcome.id, (await getIssuesForOutcome(outcome.id)).length] as [string, number],
      ),
    ),
  )
  const backHref = `/delivery/issues/${issue.key}`

  // Grouping an issue is administrator-only (SPEC/20-feature-issues-and-delivery.md): a Site Admin
  // reaches it through View As, a member not at all. Without this the picker rendered fully
  // operable for every role.
  const denial = deliveryAdminDenial(currentUser().role)

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <Link href={backHref}>{issue.key}</Link> /{' '}
            <b className="font-medium text-foreground">Set outcome</b>
          </span>
        }
        actions={
          <Link href={backHref} className={buttonVariants({ variant: 'outline' })}>
            Back to issue
          </Link>
        }
      />
      <div className="grid min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-w-0 p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {issue.key}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              <Dot color={EFFORT_COLORS[issue.effort]} />
              {issue.effort} effort
            </span>
          </div>
          <h1>{issue.title}</h1>
          <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
            The issue stays where it is while the outcome is chosen on the right.
          </p>

          <Alert variant="note" className="mt-6 max-w-prose">
            <span>
              <b>One outcome per issue.</b> The radio group is the whole difference from the
              rejected multi-parent design &mdash; a checkbox list would make this an <i>add</i>,
              and an add is what makes every roadmap total a cover instead of a count.
            </span>
          </Alert>
        </main>

        <aside
          aria-label="Set outcome"
          className="flex w-full flex-col border-l bg-card lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto"
        >
          <CloseOnEscape href={backHref} />

          <div className="flex flex-col gap-1 border-b px-6 py-4">
            <div className="flex items-start gap-3">
              <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                Set outcome
              </span>
              <Link
                href={backHref}
                className="-mr-1.5 -mt-1 ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-sm text-muted-foreground no-underline hover:bg-accent hover:text-foreground"
                aria-label="Close and return to the issue"
              >
                <span aria-hidden="true">✕</span>
              </Link>
            </div>
            <h2 className="text-lg font-semibold leading-tight">
              Which outcome does {issue.key} serve?
            </h2>
            <div className="text-xs text-muted-foreground">
              One outcome per issue. Picking another moves it.
            </div>
          </div>

          <InertForm className="flex flex-col gap-4 px-6 py-5">
            <fieldset className="m-0 border-0 p-0">
              <legend className="sr-only">Outcome</legend>
              <div className="flex flex-col rounded-md border">
                {outcomes.map((outcome) => {
                  const count = counts.get(outcome.id) ?? 0
                  return (
                    <div
                      key={outcome.id}
                      className="flex items-start gap-3 border-b px-3 py-2.5 last:border-0"
                    >
                      <input
                        type="radio"
                        name="outcome"
                        id={`outcome-${outcome.id}`}
                        value={outcome.id}
                        defaultChecked={outcome.id === current?.id}
                        disabled={denial !== null}
                        className="mt-1"
                      />
                      <label
                        htmlFor={`outcome-${outcome.id}`}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <Dot color={outcome.color} />
                          {outcome.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {count} {count === 1 ? 'issue' : 'issues'} &middot; {outcome.quarter}
                        </span>
                      </label>
                    </div>
                  )
                })}
                <div className="flex items-start gap-3 border-t px-3 py-2.5">
                  <input
                    type="radio"
                    name="outcome"
                    id="outcome-none"
                    value=""
                    defaultChecked={!current}
                    disabled={denial !== null}
                    className="mt-1"
                  />
                  <label htmlFor="outcome-none" className="min-w-0 flex-1 cursor-pointer">
                    <span className="font-medium">No outcome</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Grouping is optional; the roadmap counts these separately.
                    </span>
                  </label>
                </div>
              </div>
            </fieldset>

            {denial ? (
              <Denied reason={denial} id="why-move-issue">
                <Button
                  type="submit"
                  className="self-start"
                  aria-disabled="true"
                  aria-describedby="why-move-issue"
                >
                  Move issue
                </Button>
              </Denied>
            ) : (
              <Button type="submit" className="self-start">
                Move issue
              </Button>
            )}
            <p className="m-0 text-xs italic text-muted-foreground">
              Saving needs <code className="font-mono">PATCH /issues/{issue.key}</code>, which
              arrives with Wave D.
            </p>
          </InertForm>
        </aside>
      </div>
    </>
  )
}
