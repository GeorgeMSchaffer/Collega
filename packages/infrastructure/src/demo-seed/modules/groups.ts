import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SeedModule } from '../types.js'
import { DEMO_ACCOUNTS, DEMO_ORGANIZATIONS, seedId } from './scenario.js'

const GROUP_NAME = 'Core team'

/**
 * One group per demo organization, holding its User-role accounts, so Settings → Groups and a
 * Restricted board's access list have something to show (SPEC/contracts/groups.md).
 *
 * Idempotent: the group upserts on a derived id, and its membership is rewritten each run.
 */
export const groupsSeed: SeedModule = {
  name: 'groups',
  dependsOn: ['users'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const organizationId = seedId('organization', scenario.slug)
      const groupId = seedId('group', scenario.slug, GROUP_NAME)
      const memberIds = (scenario.accounts ?? DEMO_ACCOUNTS)
        .filter((account) => account.role === 'User')
        .map((account) => seedId('user', scenario.slug, account.localPart))

      await prisma.user_groups.upsert({
        where: { id: groupId },
        create: {
          id: groupId,
          organization_id: organizationId,
          name: GROUP_NAME,
          normalized_name: GROUP_NAME.toLowerCase(),
          description: 'Everyone who contributes ideas day to day.',
          created_at_utc: now,
          updated_at_utc: now,
        },
        update: {},
      })
      await prisma.user_group_members.deleteMany({ where: { group_id: groupId } })
      await prisma.user_group_members.createMany({
        data: memberIds.map((userId) => ({ group_id: groupId, user_id: userId })),
      })
    }
  },
}
