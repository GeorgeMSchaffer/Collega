import { DEFAULT_STATUSES } from '@collega/application/organizations'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import type { SeedModule } from '../types.ts'
import { DEMO_ORGANIZATIONS, seedId } from './scenario.ts'

/**
 * Wave B2's contribution: the five default statuses per organization, the two demo boards, and the
 * swimlanes that join them.
 *
 * Both boards allow a plain User to move an idea between statuses. That is not the product default
 * - it is what the demo data has always done, and the browser E2E flows depend on it: flow 8 moves
 * a card through every status as a User.
 */
export const boardsAndStatusesSeed: SeedModule = {
  name: 'boards-and-statuses',
  dependsOn: ['organizations'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const organizationId = seedId('organization', scenario.slug)

      for (const status of DEFAULT_STATUSES) {
        const id = seedId('status', scenario.slug, status.name)
        await prisma.statuses.upsert({
          where: { id },
          update: {
            name: status.name,
            color: status.color,
            sort_order: status.sortOrder,
            updated_at_utc: now,
          },
          create: {
            id,
            organization_id: organizationId,
            name: status.name,
            color: status.color,
            sort_order: status.sortOrder,
            is_deleted: false,
            created_at_utc: now,
            updated_at_utc: now,
          },
        })
      }

      for (const board of scenario.boards) {
        const boardId = seedId('board', scenario.slug, board.name)
        await prisma.boards.upsert({
          where: { id: boardId },
          update: { name: board.name, updated_at_utc: now },
          create: {
            id: boardId,
            organization_id: organizationId,
            name: board.name,
            allow_user_status_update: true,
            created_at_utc: now,
            updated_at_utc: now,
          },
        })

        // Every board carries all five statuses, in catalog order.
        for (const [index, status] of DEFAULT_STATUSES.entries()) {
          const swimlaneId = seedId('swimlane', scenario.slug, board.name, status.name)
          await prisma.board_swimlanes.upsert({
            where: { id: swimlaneId },
            update: { display_order: index },
            create: {
              id: swimlaneId,
              board_id: boardId,
              status_id: seedId('status', scenario.slug, status.name),
              display_order: index,
            },
          })
        }
      }
    }
  },
}
