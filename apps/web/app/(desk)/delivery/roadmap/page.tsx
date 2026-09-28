import { EmptyState, Meta } from '@collega/design-system'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { RoadmapTimeline } from '@/components/delivery/roadmap-timeline'
import { Topbar } from '@/components/nav/topbar'
import { getIssues, getSprints } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Roadmap · Collega' }

/** Every role sees the same reason: no role can add one yet. */
const NO_OUTCOMES_YET = 'Outcomes arrive in a later release'

/**
 * The Roadmap as Sprint 11 builds it: the comp R screen, drawn from the data that exists
 * (`SPEC/20-feature-issues-and-delivery.md`, "Roadmap (comp R)" — "What Sprint 11 shows").
 *
 * The timeline carries the organization's sprints. Outcomes have no backend yet, so where their
 * rows and cards will go is the empty state, and the outcome readers in `lib/data/delivery.ts` stay
 * empty on purpose.
 */
export default async function RoadmapPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [sprints, issues] = await Promise.all([getSprints(), getIssues()])
  const count = issues.length

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <b className="font-medium text-foreground">Roadmap</b>
            <Meta caps className="ml-2.5">
              {count} {count === 1 ? 'issue' : 'issues'}
            </Meta>
          </span>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title="Roadmap"
          description="The outcomes the team is working toward, when, and the issues under each."
          action={<GatedAction id="why-outcome" label="Add New Outcome" denial={NO_OUTCOMES_YET} />}
        />

        <RoadmapTimeline sprints={sprints} />

        <EmptyState
          heading="No outcomes yet"
          action={
            <GatedAction
              id="why-outcome-empty"
              label="Add the first outcome"
              denial={NO_OUTCOMES_YET}
            />
          }
        >
          {currentUser().organizationName ?? 'This deployment'} has {count} delivery{' '}
          {count === 1 ? 'issue' : 'issues'} and nothing to group them by. Outcomes, which group
          issues under what the team is working toward, arrive in a later release.
        </EmptyState>
      </main>
    </>
  )
}
