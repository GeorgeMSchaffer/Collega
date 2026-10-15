import { Alert, buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { AdminAction } from '@/components/delivery/admin-action'
import { AddIssueButton, BacklogAdd } from '@/components/delivery/backlog-add'
import { BacklogScreen } from '@/components/delivery/backlog-screen'
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
  const openSprints = sprints.filter((sprint) => sprint.state !== 'Completed')
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
          <BacklogScreen
            rows={rows}
            outcomes={outcomes}
            statuses={statuses}
            sprints={openSprints}
            editableIds={rows
              .filter((issue) => mayEditIdeaContent(user.role, user.userId, issue.authorUserId))
              .map((issue) => issue.id)}
            canAdd={addDenial === null}
            selectedId={drawer?.issue.id ?? null}
            options={formOptions}
          />
        )}
      </main>
      {rows.length === 0 ? (
        <BacklogAdd options={formOptions} sprints={openSprints} rowIds="" />
      ) : null}
      <IssueDrawer data={drawer} editing={editing} />
    </>
  )
}
