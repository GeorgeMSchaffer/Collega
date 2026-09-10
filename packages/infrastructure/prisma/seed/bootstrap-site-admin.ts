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
// is never reset back to the environment's value. Leaving it untouched is not the same as calling
// it fine, though - see `report` for what happens when the address is owned by an account that
// cannot administer anything.

import { randomUUID } from 'node:crypto'
import { normalizeEmail } from '@collega/domain/users'
import type { Role, UserStatus } from '../../src/generated/prisma/client.js'
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
    const existing = await prisma.users.findUnique({
      where: { normalized_email: normalized },
      select: { role: true, status: true },
    })
    if (existing) {
      report(email, existing)
      return
    }

    const now = new Date()
    try {
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
    } catch (error) {
      // The read above and this insert are not one transaction, and this runs from a build
      // command: two preview builds starting within a second of each other against the shared
      // staging database both read "absent" and both insert. Losing that race is the same
      // outcome as finding the row in the first place, not a failed deploy - so treat the
      // unique violation as the already-exists branch and report what the winner created.
      if (!isUniqueViolation(error)) throw error
      report(
        email,
        await prisma.users.findUniqueOrThrow({
          where: { normalized_email: normalized },
          select: { role: true, status: true },
        }),
      )
      return
    }
    console.log(`created Site Admin ${email} - it must change this password on first login.`)
  } finally {
    await prisma.$disconnect()
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  )
}

/**
 * Says what was found, and fails the deploy when what was found cannot administer anything.
 *
 * The account is left alone either way - re-granting SiteAdmin to whatever happens to own the
 * configured address would turn this script into a privilege-escalation path for anyone who can
 * set an environment variable. But leaving it alone quietly is how a deployment whose
 * SITE_ADMIN_EMAIL belongs to a deactivated or demoted account builds green and ships with no
 * usable administrator, so the mismatch is loud and non-zero instead.
 */
function report(email: string, account: { role: Role; status: UserStatus }): void {
  if (account.role === 'SiteAdmin' && account.status === 'Active') {
    console.log(
      `${email} already exists (Active SiteAdmin) - left untouched, including its password.`,
    )
    return
  }

  console.error(
    `\nSITE_ADMIN_EMAIL is ${email}, but that address belongs to an account with role ` +
      `${account.role} and status ${account.status} - not an active Site Admin. It has been left ` +
      `untouched, because this script never grants privilege to an account it did not create. ` +
      `Deploying now would produce an application with no usable administrator. Restore that ` +
      `account's role and status directly against the database, or point SITE_ADMIN_EMAIL at a ` +
      `different address.\n`,
  )
  process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
