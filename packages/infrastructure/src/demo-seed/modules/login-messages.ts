import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SeedModule } from '../types.js'
import { DEMO_ORGANIZATIONS, seedId } from './scenario.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Sign-in messages for the admin screens to list (SPEC/20-feature-login-messages.md): one system
 * banner that has ended and, per demo organization, one modal scheduled a week out. Neither is live,
 * deliberately: a live modal would open over every page of every e2e run and block its clicks.
 */
export const loginMessagesSeed: SeedModule = {
  name: 'login-messages',
  dependsOn: ['organizations'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()
    const messages = [
      {
        id: seedId('login-message', 'system', 'welcome'),
        organization_id: null,
        title: 'Welcome to Collega',
        body: 'Ideas, boards and delivery in one place. Tell us what you think from your profile menu.',
        display: 'Banner' as const,
        dismissal_mode: 'EveryLogin' as const,
        starts_at_utc: new Date(now.getTime() - 14 * DAY_MS),
        ends_at_utc: new Date(now.getTime() - DAY_MS),
      },
      ...DEMO_ORGANIZATIONS.map((scenario) => ({
        id: seedId('login-message', scenario.slug, 'policy'),
        organization_id: seedId('organization', scenario.slug),
        title: 'Updated idea review policy',
        body: 'Ideas now need a business impact before review. Please read the policy on the team wiki.',
        display: 'Modal' as const,
        dismissal_mode: 'AcknowledgeRequired' as const,
        starts_at_utc: new Date(now.getTime() + 7 * DAY_MS),
        ends_at_utc: null,
      })),
    ]

    for (const message of messages) {
      await prisma.login_messages.upsert({
        where: { id: message.id },
        update: {},
        create: {
          ...message,
          revision: 1,
          created_at_utc: now,
          updated_at_utc: now,
          created_by_user_id: null,
          updated_by_user_id: null,
        },
      })
    }
  },
}
