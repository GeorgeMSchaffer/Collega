import { randomUUID } from 'node:crypto'
import { normalizeEmail } from '@collega/domain/users'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import { Pbkdf2PasswordHasher } from '../../../src/security/pbkdf2-password-hasher.ts'
import type { SeedModule } from '../types.ts'
import {
  DEMO_ACCOUNTS,
  DEMO_ORGANIZATIONS,
  DEMO_PASSWORD,
  DEMO_SITE_ADMIN_EMAIL,
  demoEmail,
  seedId,
} from './scenario.ts'

/**
 * Wave B1's second contribution: the demo accounts.
 *
 * **Nine accounts, or ten with a configured Site Admin.** Eight organization accounts (four roles
 * x two organizations) plus the Development-only convenience Site Admin. The tenth - the
 * environment-configured Site Admin - is only seeded when `SITE_ADMIN_EMAIL` and
 * `SITE_ADMIN_PASSWORD` are both set, because inventing a credential for it would be worse than
 * leaving it absent. The definition of done's "10 users" therefore means "with the Site Admin
 * configured", which is how the .NET seeder behaved too.
 *
 * Passwords are hashed with the same `Pbkdf2PasswordHasher` the application verifies against, so
 * these accounts really can sign in. Hashing is deliberately done once per run rather than per
 * account: PBKDF2 at 100,000 iterations is slow by design, and every demo account shares one
 * password.
 */
export const usersSeed: SeedModule = {
  name: 'users',
  dependsOn: ['organizations'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()
    const hasher = new Pbkdf2PasswordHasher()
    const demoPasswordHash = hasher.hash(DEMO_PASSWORD)

    for (const scenario of DEMO_ORGANIZATIONS) {
      const organizationId = seedId('organization', scenario.slug)

      for (const account of DEMO_ACCOUNTS) {
        const email = demoEmail(account.localPart, scenario.slug)
        await upsertUser(prisma, {
          id: seedId('user', scenario.slug, account.localPart),
          organizationId,
          firstName: account.firstName,
          lastName: account.lastName,
          email,
          passwordHash: demoPasswordHash,
          role: account.role,
          mustChangePassword: false,
          now,
        })
      }
    }

    await upsertUser(prisma, {
      id: seedId('user', 'demo-site-admin'),
      organizationId: null,
      firstName: 'Sam',
      lastName: 'Sitewide',
      email: DEMO_SITE_ADMIN_EMAIL,
      passwordHash: demoPasswordHash,
      role: 'SiteAdmin',
      // Not forced, unlike the configured Site Admin: the point of this account is to reach the
      // platform-admin perspective without first walking a password change.
      mustChangePassword: false,
      now,
    })

    // Trimmed to match both the API's `required()` and `bootstrap-site-admin.ts`. The two seeding
    // paths must hash the same bytes: whichever ran first would otherwise own the row, and a
    // password with a trailing space would silently not be the one the operator set.
    const configuredEmail = process.env.SITE_ADMIN_EMAIL?.trim()
    const configuredPassword = process.env.SITE_ADMIN_PASSWORD?.trim()
    if (configuredEmail && configuredPassword) {
      await upsertUser(prisma, {
        id: seedId('user', 'configured-site-admin', normalizeEmail(configuredEmail)),
        organizationId: null,
        firstName: 'Site',
        lastName: 'Administrator',
        email: configuredEmail,
        passwordHash: hasher.hash(configuredPassword),
        role: 'SiteAdmin',
        // Forced, matching the configured account's contract - the E2E first-login flow depends
        // on it being true on a fresh database.
        mustChangePassword: true,
        now,
      })
    } else {
      console.log(
        'SITE_ADMIN_EMAIL/SITE_ADMIN_PASSWORD unset - seeding 9 users, not 10. ' +
          'Set both to seed the configured Site Admin.',
      )
    }
  },
}

type UserInput = {
  id: string
  organizationId: string | null
  firstName: string
  lastName: string
  email: string
  passwordHash: string
  role: 'SiteAdmin' | 'OrgAdmin' | 'User' | 'ReadOnly'
  mustChangePassword: boolean
  now: Date
}

async function upsertUser(prisma: PrismaClient, input: UserInput): Promise<void> {
  await prisma.users.upsert({
    where: { id: input.id },
    // Empty on purpose: an existing row is left exactly as it is. A re-run must not reset a
    // password someone changed while testing, nor clear a lockout they were deliberately
    // reproducing - and see the module header for why it must not touch timestamps either.
    update: {},
    create: {
      id: input.id,
      organization_id: input.organizationId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      normalized_email: normalizeEmail(input.email),
      password_hash: input.passwordHash,
      role: input.role,
      status: 'Active',
      must_change_password: input.mustChangePassword,
      failed_login_count: 0,
      // Random on purpose, unlike the ids: the security stamp invalidates sessions, so a
      // predictable one would be a weakness rather than a convenience.
      security_stamp: randomUUID(),
      created_at_utc: input.now,
      updated_at_utc: input.now,
    },
  })
}
