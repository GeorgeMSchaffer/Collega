import {
  DEFAULT_BUSINESS_IMPACTS,
  DEFAULT_IDEA_TYPES,
  DEFAULT_STATUSES,
} from '@collega/application/organizations'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import type { SeedModule } from '../types.ts'
import {
  CONTRIBUTOR_LOCAL_PARTS,
  DEMO_ORGANIZATIONS,
  IDEA_SCENARIOS,
  IDEAS_PER_STATUS,
  seedId,
} from './scenario.ts'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

/**
 * Wave B3's contribution: the organization's tags, 11 ideas per board, and their assignees,
 * mentions and upvotes. Two organizations x two boards x eleven ideas is the definition of done's
 * 44.
 *
 * The distribution rules are ported from the .NET seeder rather than reinvented, because
 * `apps/web`'s fixtures were written against them and `SPEC/40-test-strategy.md` names the
 * 3/2/2/1/3 spread. Two of them look arbitrary and are not:
 *
 * - **Ideas are created a minute apart, oldest first.** Boards sort by creation time, and eleven
 *   ideas sharing one instant leave the order to the database's tie-break - which reads as a board
 *   that shuffles itself between visits, and makes two identically seeded deployments disagree
 *   about what is on the first page. The counter runs across the whole organization, not per
 *   board, so idea 3 of one board never ties with idea 3 of the next.
 * - **The Read Only account authors nothing.** Contributors are the Org Admin and the two Users;
 *   a Read Only author would be data the product cannot produce.
 */
export const ideasAndUpvotesSeed: SeedModule = {
  name: 'ideas-and-upvotes',
  dependsOn: ['users', 'boards-and-statuses'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const organizationId = seedId('organization', scenario.slug)
      const contributorIds = CONTRIBUTOR_LOCAL_PARTS.map((localPart) =>
        seedId('user', scenario.slug, localPart),
      )

      const tagNames = [...new Set(scenario.boards.flatMap((board) => board.tagNames))]
      for (const name of tagNames) {
        const id = seedId('tag', scenario.slug, name)
        await prisma.tags.upsert({
          where: { id },
          update: {},
          create: {
            id,
            organization_id: organizationId,
            name,
            normalized_name: name.toLowerCase(),
            created_at_utc: now,
            updated_at_utc: now,
          },
        })
      }

      const totalIdeasInOrganization = scenario.boards.length * IDEA_SCENARIOS.length
      let seededSoFar = 0

      for (const board of scenario.boards) {
        const boardId = seedId('board', scenario.slug, board.name)
        let statusIndex = 0
        let ideasInStatus = 0

        for (const [i, ideaScenario] of IDEA_SCENARIOS.entries()) {
          if (ideasInStatus === IDEAS_PER_STATUS[statusIndex]) {
            statusIndex++
            ideasInStatus = 0
          }

          const status = DEFAULT_STATUSES[statusIndex]
          if (status === undefined) {
            throw new Error(
              `The 3/2/2/1/3 distribution ran past the ${DEFAULT_STATUSES.length} default statuses.`,
            )
          }

          const ideaId = seedId('idea', scenario.slug, board.name, ideaScenario.title)
          const authorUserId = contributorIds[i % contributorIds.length] as string
          const createdAt = new Date(
            now.getTime() - (totalIdeasInOrganization - seededSoFar) * 60_000,
          )
          const dueDate =
            i % 3 === 0 ? null : new Date(now.getTime() + (7 + i) * 24 * 60 * 60 * 1000)

          await prisma.ideas.upsert({
            where: { id: ideaId },
            update: {},
            create: {
              id: ideaId,
              organization_id: organizationId,
              board_id: boardId,
              status_id: seedId('status', scenario.slug, status.name),
              title: `${board.focus}: ${ideaScenario.title}`,
              description: `${ideaScenario.description} This scenario supports ${board.focus.toLowerCase()} at ${scenario.title}.`,
              priority: PRIORITIES[i % PRIORITIES.length] as (typeof PRIORITIES)[number],
              idea_type_id: seedId(
                'idea-type',
                scenario.slug,
                (DEFAULT_IDEA_TYPES[i % DEFAULT_IDEA_TYPES.length] as { name: string }).name,
              ),
              business_impact_id: seedId(
                'business-impact',
                scenario.slug,
                (DEFAULT_BUSINESS_IMPACTS[i % DEFAULT_BUSINESS_IMPACTS.length] as { name: string })
                  .name,
              ),
              due_date: dueDate,
              author_user_id: authorUserId,
              is_deleted: false,
              created_at_utc: createdAt,
              updated_at_utc: createdAt,
            },
          })

          const relatedCount = i % 3

          for (let offset = 1; offset <= relatedCount; offset++) {
            const userId = contributorIds[(i + offset) % contributorIds.length] as string
            await prisma.idea_assignees.upsert({
              where: { idea_id_user_id: { idea_id: ideaId, user_id: userId } },
              update: {},
              create: { id: seedId('assignee', ideaId, userId), idea_id: ideaId, user_id: userId },
            })
          }

          for (let offset = 0; offset < relatedCount; offset++) {
            const tagName = board.tagNames[(i + offset) % board.tagNames.length] as string
            const tagId = seedId('tag', scenario.slug, tagName)
            await prisma.idea_tags.upsert({
              where: { idea_id_tag_id: { idea_id: ideaId, tag_id: tagId } },
              update: {},
              create: { id: seedId('idea-tag', ideaId, tagId), idea_id: ideaId, tag_id: tagId },
            })
          }

          for (let offset = 0; offset < relatedCount; offset++) {
            const userId = contributorIds[(i + offset + 1) % contributorIds.length] as string
            await prisma.idea_upvotes.upsert({
              where: { idea_id_user_id: { idea_id: ideaId, user_id: userId } },
              update: {},
              create: {
                id: seedId('upvote', ideaId, userId),
                idea_id: ideaId,
                user_id: userId,
                created_at_utc: createdAt,
              },
            })
          }

          if (i % 4 === 0) {
            const mentionedUserId = contributorIds[(i + 1) % contributorIds.length] as string
            await prisma.idea_mentions.upsert({
              where: {
                idea_id_mentioned_user_id: { idea_id: ideaId, mentioned_user_id: mentionedUserId },
              },
              update: {},
              create: {
                id: seedId('idea-mention', ideaId, mentionedUserId),
                idea_id: ideaId,
                mentioned_user_id: mentionedUserId,
              },
            })
          }

          seededSoFar++
          ideasInStatus++
        }
      }
    }
  },
}
