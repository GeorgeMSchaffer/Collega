import { DEFAULT_BUSINESS_IMPACTS, DEFAULT_IDEA_TYPES } from '@collega/application/organizations'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import type { SeedModule } from '../types.ts'
import { DEMO_ORGANIZATIONS, seedId } from './scenario.ts'

/**
 * Wave B1's contribution: the two demo organizations and the per-organization catalogs every
 * organization is provisioned with (`SPEC/20-feature-boards-and-statuses.md`, and Phase 4 #9 of
 * `SPEC/50-technical-implementation-plan.md` for idea types).
 *
 * Statuses and boards are deliberately NOT here - they are B2's, and live in their own module, so
 * two slices adding to the seed conflict over the module list rather than inside one file.
 *
 * The catalog values are imported from `@collega/application/organizations` rather than restated:
 * they are the same constants the bootstrap service provisions a real organization with, so a seeded
 * organization and a created one cannot drift apart.
 */
export const organizationsSeed: SeedModule = {
  name: 'organizations',

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const organizationId = seedId('organization', scenario.slug)

      await prisma.organizations.upsert({
        where: { id: organizationId },
        update: {},
        create: {
          id: organizationId,
          title: scenario.title,
          description: scenario.description,
          // Derived, not random: the .NET seeder appended random hex, which is fine for a real
          // organization and wrong for a fixture that has to be reproducible.
          invite_code:
            `${scenario.slug}-${seedId('invite', scenario.slug).slice(0, 8)}`.toUpperCase(),
          is_archived: false,
          created_at_utc: now,
          updated_at_utc: now,
        },
      })

      for (const ideaType of DEFAULT_IDEA_TYPES) {
        const id = seedId('idea-type', scenario.slug, ideaType.name)
        await prisma.idea_types.upsert({
          where: { id },
          update: {},
          create: {
            id,
            organization_id: organizationId,
            name: ideaType.name,
            sort_order: ideaType.sortOrder,
            is_deleted: false,
            created_at_utc: now,
            updated_at_utc: now,
          },
        })
      }

      for (const impact of DEFAULT_BUSINESS_IMPACTS) {
        const id = seedId('business-impact', scenario.slug, impact.name)
        await prisma.business_impacts.upsert({
          where: { id },
          update: {},
          create: {
            id,
            organization_id: organizationId,
            name: impact.name,
            color: impact.color,
            sort_order: impact.sortOrder,
            is_deleted: false,
            created_at_utc: now,
            updated_at_utc: now,
          },
        })
      }
    }
  },
}
