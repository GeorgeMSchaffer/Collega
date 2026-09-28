import type { PrismaClient } from '../generated/prisma/client.js'
import { order } from './compose.js'
import { boardsAndStatusesSeed } from './modules/boards-and-statuses.js'
import { commentsSeed } from './modules/comments.js'
import { deliverySeed } from './modules/delivery.js'
import { ideasAndUpvotesSeed } from './modules/ideas-and-upvotes.js'
import { organizationsSeed } from './modules/organizations.js'
import { DEMO_ORGANIZATIONS, seedId } from './modules/scenario.js'
import { usersSeed } from './modules/users.js'
import type { SeedModule } from './types.js'

/**
 * The demo seed, callable rather than only runnable.
 *
 * It used to live entirely under `prisma/seed/` and exist only as a CLI. It moved into `src` so the
 * API can offer it to a Site Admin from the settings screen: a deployed demo has nothing in it but
 * a bootstrap administrator, and a Site Admin belongs to no organization — so until somebody seeds
 * it there is no organization to open, nobody to view as, and nothing to demonstrate.
 * `prisma/seed/index.ts` is now a thin wrapper over this, so the command and the button run exactly
 * the same code.
 */

/** Every module in the seed. A feature slice adds its own here, alongside the module file. */
const MODULES: readonly SeedModule[] = [
  organizationsSeed,
  usersSeed,
  boardsAndStatusesSeed,
  ideasAndUpvotesSeed,
  commentsSeed,
  deliverySeed,
]

export type SeedOutcome = {
  readonly module: string
  readonly milliseconds: number
}

/**
 * Runs every module in dependency order.
 *
 * Idempotent by contract — each module upserts on a deterministic id — so calling this twice is
 * safe and is the ordinary way to repair a demo somebody edited while exploring.
 */
export async function runDemoSeed(prisma: PrismaClient): Promise<readonly SeedOutcome[]> {
  const outcomes: SeedOutcome[] = []
  for (const seedModule of order(MODULES)) {
    const started = Date.now()
    await seedModule.seed(prisma)
    outcomes.push({ module: seedModule.name, milliseconds: Date.now() - started })
  }
  return outcomes
}

/**
 * Deletes everything the seed owns, so the next run rebuilds it from nothing.
 *
 * **It can say what it owns because every seeded id is derived, not random.** `seedId` hashes the
 * organization's slug and the row's own name, so the two demo organizations and everything beneath
 * them are identifiable without a marker column and without guessing at titles. That is what makes
 * a reset safe to expose: it cannot reach a row the seed did not create, so an organization
 * somebody made by hand survives a reset of the demo data sitting beside it.
 *
 * The order is the foreign-key graph read backwards, and `ideas.board_id` is handled by
 * organization rather than by board because it carries an index and no foreign key — deleting a
 * board does not fail when ideas still point at it, it orphans them silently.
 */
export async function resetDemoSeed(prisma: PrismaClient): Promise<number> {
  const organizationIds = DEMO_ORGANIZATIONS.map((scenario) =>
    seedId('organization', scenario.slug),
  )
  const org = { organization_id: { in: organizationIds } }

  const ideas = await prisma.ideas.findMany({ where: org, select: { id: true } })
  const ideaIds = ideas.map((idea) => idea.id)
  const byIdea = { idea_id: { in: ideaIds } }

  const users = await prisma.users.findMany({ where: org, select: { id: true } })
  const userIds = users.map((user) => user.id)

  let deleted = 0
  const remove = async (count: Promise<{ count: number }>) => {
    deleted += (await count).count
  }

  await remove(prisma.comment_mentions.deleteMany({ where: { comments: byIdea } }))
  await remove(prisma.comments.deleteMany({ where: byIdea }))
  await remove(prisma.idea_assignees.deleteMany({ where: byIdea }))
  await remove(prisma.idea_mentions.deleteMany({ where: byIdea }))
  await remove(prisma.idea_upvotes.deleteMany({ where: byIdea }))
  await remove(prisma.idea_tags.deleteMany({ where: byIdea }))
  await remove(prisma.idea_field_values.deleteMany({ where: byIdea }))
  await remove(prisma.issue_tasks.deleteMany({ where: byIdea }))
  await remove(prisma.notification_events.deleteMany({ where: org }))
  await remove(prisma.ideas.deleteMany({ where: org }))
  await remove(prisma.board_swimlanes.deleteMany({ where: { boards: org } }))
  await remove(prisma.boards.deleteMany({ where: org }))
  await remove(prisma.idea_type_fields.deleteMany({ where: { idea_types: org } }))
  await remove(prisma.field_definition_options.deleteMany({ where: { field_definitions: org } }))
  await remove(prisma.field_definitions.deleteMany({ where: org }))
  await remove(prisma.idea_types.deleteMany({ where: org }))
  await remove(prisma.statuses.deleteMany({ where: org }))
  await remove(prisma.tags.deleteMany({ where: org }))
  await remove(prisma.business_impacts.deleteMany({ where: org }))
  await remove(prisma.sprints.deleteMany({ where: org }))
  await remove(prisma.ai_usage_records.deleteMany({ where: org }))
  await remove(
    prisma.impersonation_sessions.deleteMany({
      where: { OR: [{ real_user_id: { in: userIds } }, { target_user_id: { in: userIds } }] },
    }),
  )

  // Nullable columns, so the trail survives with the actor blanked - the only thing a restricted
  // foreign key allows, and the right answer for an audit log regardless.
  await prisma.audit_events.updateMany({
    where: { actor_user_id: { in: userIds } },
    data: { actor_user_id: null },
  })
  await prisma.audit_events.updateMany({
    where: { on_behalf_of_user_id: { in: userIds } },
    data: { on_behalf_of_user_id: null },
  })
  await remove(prisma.audit_events.deleteMany({ where: org }))

  await remove(prisma.users.deleteMany({ where: org }))
  await remove(prisma.organizations.deleteMany({ where: { id: { in: organizationIds } } }))

  return deleted
}
