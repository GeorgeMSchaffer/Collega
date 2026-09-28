import { DEFAULT_STATUSES } from '@collega/application/organizations'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SeedModule } from '../types.js'
import { DEMO_ORGANIZATIONS, seedId } from './scenario.js'

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
          update: { name: status.name, sort_order: status.sortOrder, is_deleted: false },
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

      // The board list names who created each board; the organization's admin is who would have.
      // No foreign key backs `created_by_user_id`, so the users module need not run first.
      const creatorId = seedId('user', scenario.slug, 'orgadmin')

      for (const board of scenario.boards) {
        const boardId = seedId('board', scenario.slug, board.name)
        await prisma.boards.upsert({
          where: { id: boardId },
          update: {
            name: board.name,
            description: board.description,
            created_by_user_id: creatorId,
          },
          create: {
            id: boardId,
            organization_id: organizationId,
            name: board.name,
            description: board.description,
            allow_user_status_update: true,
            created_at_utc: now,
            updated_at_utc: now,
            created_by_user_id: creatorId,
            updated_by_user_id: creatorId,
          },
        })

        // Every board carries all five statuses, in catalog order. Keyed on (board, status), not
        // the seed id: saving a board's lanes rewrites their rows under fresh ids, and an upsert by
        // id would then collide with ux_board_swimlanes_board_id_status_id.
        for (const [index, status] of DEFAULT_STATUSES.entries()) {
          const statusId = seedId('status', scenario.slug, status.name)
          await prisma.board_swimlanes.upsert({
            where: { board_id_status_id: { board_id: boardId, status_id: statusId } },
            update: {},
            create: {
              id: seedId('swimlane', scenario.slug, board.name, status.name),
              board_id: boardId,
              status_id: statusId,
              display_order: index,
            },
          })
        }
      }
    }
  },
}
