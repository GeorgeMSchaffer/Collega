import { EmptyState, Meta } from '@collega/design-system'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { OutcomeCards } from '@/components/delivery/outcome-cards'
import { RoadmapTimeline } from '@/components/delivery/roadmap-timeline'
import { Topbar } from '@/components/nav/topbar'
import { getMemberOptions, getOutcomeRoadmap, getSprints, getStatuses } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Roadmap · Collega' }

/** Every role sees the same reason: no role can add one from this screen yet. */
const NO_OUTCOMES_YET = 'Adding outcomes arrives in a later release'

/**
 * The Roadmap (`SPEC/20-feature-issues-and-delivery.md`, "Roadmap (comp R)"): the Outcomes on a time
 * axis beside the sprints, then a card per Outcome with the items grouped under it.
 *
 * Read-only. The items are what the roadmap read returns: top-level items on any board, not only
 * Issues in their Delivery phase, so the count is of items.
 */
export default async function RoadmapPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [roadmap, sprints, statuses, members] = await Promise.all([
    getOutcomeRoadmap(),
    getSprints(),
    getStatuses(),
    getMemberOptions(),
  ])
  const { outcomes, ungrouped } = roadmap
  const grouped = outcomes.reduce((total, outcome) => total + outcome.ideaCount, 0)
  const items = grouped + ungrouped.length

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <b className="font-medium text-foreground">Roadmap</b>
            <Meta caps className="ml-2.5">
              {outcomes.length} {outcomes.length === 1 ? 'outcome' : 'outcomes'} · {items}{' '}
              {items === 1 ? 'item' : 'items'}
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

        <RoadmapTimeline sprints={sprints} outcomes={outcomes} />

        {outcomes.length === 0 ? (
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
            {currentUser().organizationName ?? 'This deployment'} has {items}{' '}
            {items === 1 ? 'item' : 'items'} and nothing to group them by. Outcomes group items
            under what the team is working toward.
          </EmptyState>
        ) : (
          <>
            <OutcomeCards
              outcomes={outcomes}
              statuses={new Map(statuses.map((status) => [status.id, status]))}
              members={new Map(members.map((member) => [member.id, member]))}
            />
            <p className="m-0 text-sm text-muted-foreground">
              {ungrouped.length} {ungrouped.length === 1 ? 'item is' : 'items are'} under no
              outcome. Each item sits under at most one, so the counts above add up to the {items}{' '}
              {items === 1 ? 'item' : 'items'} the roadmap lists.
            </p>
          </>
        )}
      </main>
    </>
  )
}
