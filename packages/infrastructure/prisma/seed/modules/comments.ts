import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import type { SeedModule } from '../types.ts'
import { CONTRIBUTOR_LOCAL_PARTS, DEMO_ORGANIZATIONS, IDEA_SCENARIOS, seedId } from './scenario.ts'

/**
 * Wave B4's contribution: a short thread on the first two ideas of every board, so the engagement
 * surfaces have something to render.
 *
 * Timestamps are minutes apart in the order they read as a conversation. Two comments on one idea
 * sharing an instant leave their order to the database's tie-break, and a thread that reorders
 * itself between reads is not a thread.
 */
const THREAD: readonly {
  ideaIndex: number
  contributor: number
  body: string
  minutesAgo: number
}[] = [
  {
    ideaIndex: 0,
    contributor: 1,
    body: "Thanks for raising this - I'll take a first look.",
    minutesAgo: 3,
  },
  {
    ideaIndex: 0,
    contributor: 0,
    body: "Agreed, let's prioritize it for the next review.",
    minutesAgo: 2,
  },
  {
    ideaIndex: 1,
    contributor: 2,
    body: 'Following along - this would help my team too.',
    minutesAgo: 1,
  },
]

export const commentsSeed: SeedModule = {
  name: 'comments',
  dependsOn: ['ideas-and-upvotes'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const contributorIds = CONTRIBUTOR_LOCAL_PARTS.map((localPart) =>
        seedId('user', scenario.slug, localPart),
      )

      for (const board of scenario.boards) {
        for (const entry of THREAD) {
          const ideaScenario = IDEA_SCENARIOS[entry.ideaIndex]
          if (ideaScenario === undefined) {
            throw new Error(`The demo thread references idea ${entry.ideaIndex}, which is absent.`)
          }

          const ideaId = seedId('idea', scenario.slug, board.name, ideaScenario.title)
          const authorUserId = contributorIds[entry.contributor] as string
          const id = seedId('comment', ideaId, String(entry.minutesAgo))
          const createdAt = new Date(now.getTime() - entry.minutesAgo * 60_000)

          await prisma.comments.upsert({
            where: { id },
            update: { body: entry.body },
            create: {
              id,
              idea_id: ideaId,
              author_user_id: authorUserId,
              body: entry.body,
              created_at_utc: createdAt,
              updated_at_utc: createdAt,
            },
          })
        }
      }
    }
  },
}
