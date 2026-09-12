import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import type { SeedModule } from '../types.ts'
import { CONTRIBUTOR_LOCAL_PARTS, DEMO_ORGANIZATIONS, IDEA_SCENARIOS, seedId } from './scenario.ts'

/**
 * Issues-and-Delivery's contribution: a sprint per organization with issues in it, so the delivery
 * board and the sprint screens have something to render.
 *
 * Without this the tables exist, the routes answer, and every delivery surface is empty — which
 * reads as a broken feature rather than an unseeded one.
 *
 * **Promotion is written here rather than called through the domain.** `promoteIdeaToIssue` takes an
 * `Idea` and returns one; the seed writes rows. The fields below are the ones that function sets,
 * and the pairing is deliberate: `phase: Delivery` always carries a `delivery_status`, an `effort`,
 * a `promoted_at_utc`, a `promoted_by_user_id` and an `upvote_count_at_promotion`, because the
 * domain treats a promoted idea missing any of them as incoherent. Change the gate and this module
 * has to move with it.
 */

/** Which `IDEA_SCENARIOS` entries get promoted, and what state each lands in. */
const PROMOTIONS: readonly {
  ideaIndex: number
  effort: 'Low' | 'Medium' | 'High'
  deliveryStatus: 'Pending' | 'Scoping' | 'Development' | 'Review' | 'Complete'
  /** false puts the issue in the delivery backlog, which is what a null sprint means. */
  inSprint: boolean
  /** Whose commitment this was — an index into CONTRIBUTOR_LOCAL_PARTS. */
  promotedBy: number
  upvotesAtPromotion: number
}[] = [
  // One per swimlane, so the board renders every column with something in it rather than
  // demonstrating only the happy path.
  {
    ideaIndex: 0,
    effort: 'High',
    deliveryStatus: 'Development',
    inSprint: true,
    promotedBy: 0,
    upvotesAtPromotion: 7,
  },
  {
    ideaIndex: 1,
    effort: 'Medium',
    deliveryStatus: 'Review',
    inSprint: true,
    promotedBy: 0,
    upvotesAtPromotion: 5,
  },
  {
    ideaIndex: 2,
    effort: 'Low',
    deliveryStatus: 'Scoping',
    inSprint: true,
    promotedBy: 1,
    upvotesAtPromotion: 3,
  },
  {
    ideaIndex: 3,
    effort: 'Medium',
    deliveryStatus: 'Complete',
    inSprint: true,
    promotedBy: 0,
    upvotesAtPromotion: 9,
  },
  // Backlog: promoted, committed to, not yet pulled into a sprint.
  {
    ideaIndex: 4,
    effort: 'High',
    deliveryStatus: 'Pending',
    inSprint: false,
    promotedBy: 0,
    upvotesAtPromotion: 2,
  },
]

/**
 * Checklists on the two issues furthest along. `sort_order` is explicit and contiguous from zero —
 * the reorder endpoint rewrites it wholesale, and a seed that left gaps would make the first
 * reorder look like it had changed something it had not.
 */
const CHECKLISTS: readonly {
  ideaIndex: number
  items: readonly {
    title: string
    state: 'NotStarted' | 'InProgress' | 'Done'
    assignee: number | null
  }[]
}[] = [
  {
    ideaIndex: 0,
    items: [
      { title: 'Agree the target handoff and its owner', state: 'Done', assignee: 0 },
      { title: 'Instrument the current transition', state: 'Done', assignee: 1 },
      { title: 'Build the automation behind a flag', state: 'InProgress', assignee: 1 },
      { title: 'Measure a week against the baseline', state: 'NotStarted', assignee: null },
    ],
  },
  {
    ideaIndex: 1,
    items: [
      { title: 'Pick the signal that predicts the delay', state: 'Done', assignee: 2 },
      { title: 'Route the alert to the responsible team', state: 'InProgress', assignee: 2 },
      { title: 'Agree what a false positive costs', state: 'NotStarted', assignee: null },
    ],
  },
]

/** Sprint dates as whole days, matching the schema's `@db.Date`. */
function dayUtc(base: Date, offsetDays: number): Date {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offsetDays),
  )
  return d
}

export const deliverySeed: SeedModule = {
  name: 'delivery',
  // Issues are promoted ideas, and the checklist assignees are seeded users.
  dependsOn: ['ideas-and-upvotes'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const organizationId = seedId('organization', scenario.slug)
      const contributorIds = CONTRIBUTOR_LOCAL_PARTS.map((localPart) =>
        seedId('user', scenario.slug, localPart),
      )
      const owner = contributorIds[0] as string

      // Promotions land on the first board, so the second stays purely in Discovery — a reader
      // comparing the two can see what promotion actually changed.
      const board = scenario.boards[0]
      if (board === undefined) {
        throw new Error(`Organization '${scenario.slug}' has no boards to promote ideas from.`)
      }

      // Active and dated around today, so the sprint screens are never showing a box that ended
      // last year on a freshly seeded machine.
      const sprintId = seedId('sprint', scenario.slug, 'current')
      await prisma.sprints.upsert({
        where: { id: sprintId },
        update: {},
        create: {
          id: sprintId,
          organization_id: organizationId,
          name: 'Current sprint',
          goal: `Move ${board.focus.toLowerCase()} forward with something measurable.`,
          start_date: dayUtc(now, -4),
          end_date: dayUtc(now, 10),
          owner_user_id: owner,
          state: 'Active',
          is_deleted: false,
          created_at_utc: now,
          updated_at_utc: now,
          created_by_user_id: owner,
          updated_by_user_id: owner,
        },
      })

      // One Planned sprint too: the list screen has a state filter, and a single row cannot show it
      // doing anything.
      const nextSprintId = seedId('sprint', scenario.slug, 'next')
      await prisma.sprints.upsert({
        where: { id: nextSprintId },
        update: {},
        create: {
          id: nextSprintId,
          organization_id: organizationId,
          name: 'Next sprint',
          goal: null,
          start_date: dayUtc(now, 11),
          end_date: dayUtc(now, 25),
          owner_user_id: owner,
          state: 'Planned',
          is_deleted: false,
          created_at_utc: now,
          updated_at_utc: now,
          created_by_user_id: owner,
          updated_by_user_id: owner,
        },
      })

      for (const promotion of PROMOTIONS) {
        const ideaScenario = IDEA_SCENARIOS[promotion.ideaIndex]
        if (ideaScenario === undefined) {
          throw new Error(
            `The delivery seed references idea ${promotion.ideaIndex}, which is absent.`,
          )
        }
        const ideaId = seedId('idea', scenario.slug, board.name, ideaScenario.title)
        const promotedBy = contributorIds[promotion.promotedBy] as string

        // `update` is populated here, unlike the other modules' no-op upserts: the ideas rows
        // already exist from ideas-and-upvotes, so promotion is always an update to a row this
        // module did not create. Re-running must land the same state rather than leave whatever a
        // previous run's clicking left behind.
        const promoted = {
          phase: 'Delivery' as const,
          delivery_status: promotion.deliveryStatus,
          effort: promotion.effort,
          sprint_id: promotion.inSprint ? sprintId : null,
          promoted_at_utc: now,
          promoted_by_user_id: promotedBy,
          upvote_count_at_promotion: promotion.upvotesAtPromotion,
          updated_at_utc: now,
          updated_by_user_id: promotedBy,
        }

        // The idea may be absent if ideas-and-upvotes seeded a different set — say so rather than
        // failing later on a foreign key that does not name this module.
        const existing = await prisma.ideas.findUnique({ where: { id: ideaId } })
        if (existing === null) {
          throw new Error(
            `The delivery seed expected idea '${ideaScenario.title}' on board '${board.name}' ` +
              `of '${scenario.slug}', which ideas-and-upvotes did not create.`,
          )
        }
        await prisma.ideas.update({ where: { id: ideaId }, data: promoted })
      }

      for (const checklist of CHECKLISTS) {
        const ideaScenario = IDEA_SCENARIOS[checklist.ideaIndex]
        if (ideaScenario === undefined) {
          throw new Error(
            `The delivery seed references idea ${checklist.ideaIndex}, which is absent.`,
          )
        }
        const ideaId = seedId('idea', scenario.slug, board.name, ideaScenario.title)

        let sortOrder = 0
        for (const item of checklist.items) {
          const id = seedId('issue-task', ideaId, item.title)
          const completed = item.state === 'Done'
          const assignee = item.assignee === null ? null : (contributorIds[item.assignee] as string)

          await prisma.issue_tasks.upsert({
            where: { id },
            update: {},
            create: {
              id,
              idea_id: ideaId,
              title: item.title,
              assignee_user_id: assignee,
              state: item.state,
              sort_order: sortOrder,
              // A Done task without a completion stamp is the state the rollup and the audit trail
              // disagree about, so the two always move together.
              completed_at_utc: completed ? now : null,
              completed_by_user_id: completed ? assignee : null,
              created_at_utc: now,
              updated_at_utc: now,
              created_by_user_id: owner,
              updated_by_user_id: owner,
            },
          })
          sortOrder += 1
        }
      }
    }
  },
}
