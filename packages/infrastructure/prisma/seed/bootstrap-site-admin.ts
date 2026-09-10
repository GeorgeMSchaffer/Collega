// Creates the configured Site Admin, and nothing else. This is the ONLY seeding that may run
// against production, and it is what makes a fresh deployment reachable at all.
//
//   pnpm --filter @collega/infrastructure db:bootstrap-admin
//
// `SPEC/20-feature-auth.md` requirement 8 says a Site Admin is created on first run from
// SITE_ADMIN_EMAIL / SITE_ADMIN_PASSWORD, and requirement 9 says it must change that credential on
// first login. The .NET host did that in `StartupSeeder` at boot; `apps/api` reads both variables
// and never acts on them, so a production database created by `prisma migrate deploy` has zero
// users and a login screen nobody can pass. On serverless, boot is the wrong place to put it back -
// "first run" happens on every cold start - so it runs once per deploy instead, from the API
// project's build command (`apps/api/vercel.json`), and by hand from anyone holding DATABASE_URL.
//
// It is deliberately NOT the demo seed. That one refuses to run when NODE_ENV=production and
// creates nine demo accounts; this one creates a single administrator and reads its credential
// from the environment, so nothing is invented and nothing is committed.
//
// Idempotent, and safe to leave in a build command that runs on every deploy: an account that
// already exists is reported and left untouched, so a password the administrator has since changed
// is never reset back to the environment's value.

import { randomUUID } from 'node:crypto'
import { normalizeEmail } from '@collega/domain/users'
import { PrismaClient } from '../../src/generated/prisma/client.js'
import { Pbkdf2PasswordHasher } from '../../src/security/pbkdf2-password-hasher.ts'
import { seedId } from './modules/scenario.ts'

async function main(): Promise<void> {
  const email = process.env.SITE_ADMIN_EMAIL?.trim()
  const password = process.env.SITE_ADMIN_PASSWORD?.trim()

  if (!email || !password) {
    console.log(
      'SITE_ADMIN_EMAIL/SITE_ADMIN_PASSWORD unset - no Site Admin to create. ' +
        'Set both to bootstrap the first administrator.',
    )
    return
  }

  const normalized = normalizeEmail(email)
  const prisma = new PrismaClient()
  try {
    // By normalized email rather than by id: the id below is derived, but an administrator created
    // some other way still owns the address, and the unique index on it would fail the insert.
    const existing = await prisma.users.findFirst({
      where: { normalized_email: normalized },
      select: { id: true, role: true },
    })
    if (existing) {
      console.log(
        `${email} already exists (role ${existing.role}) - left untouched, including its password.`,
      )
      return
    }

    const now = new Date()
    await prisma.users.create({
      data: {
        // Derived through the demo seed's own namespace on purpose. The demo seed creates this
        // same account when both variables are set, so sharing the derivation means a development
        // database that has seen both paths holds one row rather than colliding on the email.
        id: seedId('user', 'configured-site-admin', normalized),
        organization_id: null, // Requirement 7: the Site Admin belongs to no organization.
        first_name: 'Site',
        last_name: 'Administrator',
        email,
        normalized_email: normalized,
        password_hash: new Pbkdf2PasswordHasher().hash(password),
        role: 'SiteAdmin',
        status: 'Active',
        must_change_password: true, // Requirement 9.
        failed_login_count: 0,
        security_stamp: randomUUID(),
        created_at_utc: now,
        updated_at_utc: now,
      },
    })
    console.log(`created Site Admin ${email} - it must change this password on first login.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
