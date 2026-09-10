// Creates the configured organization - catalogs, default board, and optionally its first Org
// Admin - and nothing else. Alongside `bootstrap-site-admin.ts`, this is the only seeding that may
// run against production.
//
//   pnpm --filter @collega/infrastructure db:bootstrap-organization
//
// `db:bootstrap-admin` leaves a fresh deployment with exactly one row: a Site Admin who belongs to
// no organization (`SPEC/20-feature-organizations-and-users.md` User Rule 7) and therefore signs in
// to an application containing no organization, no board, and no catalogs. There is no admin write
// path in `apps/web` yet, and idea creation needs an active idea type AND an active business impact,
// so that state cannot be escaped from the UI. This script is what gets past it.
//
// Deliberately NOT in the API's build command, unlike `db:bootstrap-admin`. That one is coupled to
// deployment - the API refuses to boot without its two variables - whereas which organization
// exists is a business decision with no such coupling. More pointedly, this script's whole output
// is an invite code and, when it mints one, a temporary password; a Vercel build log is retained
// and readable by everyone with project access, which is the wrong place for either. It is run once,
// by hand, by whoever holds DATABASE_URL. See `SPEC/50-vercel-deployment.md` §8a.
//
// Idempotent. Every write is an upsert on a derived id with an empty `update`, the idiom the demo
// seed settled on (`seed/modules/users.ts`): an organization that already exists is left exactly as
// it is, including catalogs an administrator has since renamed, reordered or archived. A
// `findFirst`-then-`create` would be a TOCTOU race that fails a concurrent run on a unique
// constraint, which is the defect already fixed once in `bootstrap-site-admin.ts`.

import { randomUUID } from 'node:crypto'
import {
  DEFAULT_BOARD_NAME,
  DEFAULT_BUSINESS_IMPACTS,
  DEFAULT_IDEA_TYPES,
  DEFAULT_STATUSES,
} from '@collega/application/organizations'
import { normalizeInviteCode } from '@collega/domain/organizations'
import { generateTemporaryPassword, normalizeEmail } from '@collega/domain/users'
import type { PrismaClient as PrismaClientType } from '../../src/generated/prisma/client.js'
import { PrismaClient } from '../../src/generated/prisma/client.js'
import { RandomInviteCodeGenerator } from '../../src/integrations/organizations/random-invite-code-generator.ts'
import { Pbkdf2PasswordHasher } from '../../src/security/pbkdf2-password-hasher.ts'
import { seedId } from './modules/scenario.ts'

async function main(): Promise<void> {
  const title = process.env.BOOTSTRAP_ORG_TITLE?.trim()
  const description = process.env.BOOTSTRAP_ORG_DESCRIPTION?.trim()
  const adminEmail = process.env.BOOTSTRAP_ORG_ADMIN_EMAIL?.trim()

  if (!title || !description) {
    const missing = [
      ...(title ? [] : ['BOOTSTRAP_ORG_TITLE']),
      ...(description ? [] : ['BOOTSTRAP_ORG_DESCRIPTION']),
    ]
    console.log(
      `${missing.join('/')} unset - no organization to create. ` +
        'Set both to bootstrap the first organization.',
    )
    return
  }

  // Derived from the title so a re-run with the same configuration is a no-op rather than a second
  // organization. Its own namespace part, so this can never collide with a demo organization.
  const organizationId = seedId('organization', 'bootstrap', title.toLowerCase())

  const prisma = new PrismaClient()
  try {
    const now = new Date()

    await prisma.organizations.upsert({
      where: { id: organizationId },
      update: {},
      create: {
        id: organizationId,
        title,
        description,
        // Random, unlike the demo seed's derived codes: this one is a real credential-shaped value
        // that lets anyone holding it join the organization, so it must not be reproducible from
        // the organization's name.
        invite_code: normalizeInviteCode(new RandomInviteCodeGenerator().generate()),
        is_archived: false,
        created_at_utc: now,
        updated_at_utc: now,
      },
    })

    await provisionCatalogs(prisma, organizationId, title, now)
    await provisionDefaultBoard(prisma, organizationId, title, now)

    // Read back rather than reusing the generated value: on a re-run the create above did nothing,
    // and the code an administrator has since regenerated is the one people must be given.
    const organization = await prisma.organizations.findUniqueOrThrow({
      where: { id: organizationId },
      select: { title: true, invite_code: true, is_archived: true },
    })

    console.log(`organization '${organization.title}' is provisioned.`)
    if (organization.is_archived) {
      // Archived organizations' invite codes are rejected at registration
      // (org-and-users requirement #9), so printing joining instructions would be a lie.
      console.error(
        `\n'${organization.title}' is archived. Its invite code will be refused at registration ` +
          'and nobody can join it. Unarchive it before handing the code to anyone.\n',
      )
      process.exitCode = 1
      return
    }

    if (adminEmail) await provisionFirstOrgAdmin(prisma, organizationId, adminEmail, now)
    printJoiningInstructions(organization.title, organization.invite_code)
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * The idea types and business impacts every organization is provisioned with. Imported from
 * `@collega/application/organizations` rather than restated, for the reason
 * `seed/modules/organizations.ts` gives: these are the same constants `POST /organizations`
 * provisions through `OrganizationBootstrapPort`, so an organization created here and one created
 * through the API cannot drift apart.
 */
async function provisionCatalogs(
  prisma: PrismaClientType,
  organizationId: string,
  title: string,
  now: Date,
): Promise<void> {
  for (const ideaType of DEFAULT_IDEA_TYPES) {
    const id = seedId('idea-type', 'bootstrap', title.toLowerCase(), ideaType.name)
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
    const id = seedId('business-impact', 'bootstrap', title.toLowerCase(), impact.name)
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

/** The five default statuses and the single default board that carries all of them, matching what
 * `OrganizationBootstrapRepository.provisionDefaults` builds for an organization created through
 * the API (`SPEC/20-feature-boards-and-statuses.md` Board Rules #4). */
async function provisionDefaultBoard(
  prisma: PrismaClientType,
  organizationId: string,
  title: string,
  now: Date,
): Promise<void> {
  for (const status of DEFAULT_STATUSES) {
    const id = seedId('status', 'bootstrap', title.toLowerCase(), status.name)
    await prisma.statuses.upsert({
      where: { id },
      update: {},
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

  const boardId = seedId('board', 'bootstrap', title.toLowerCase(), DEFAULT_BOARD_NAME)
  await prisma.boards.upsert({
    where: { id: boardId },
    update: {},
    create: {
      id: boardId,
      organization_id: organizationId,
      name: DEFAULT_BOARD_NAME,
      allow_user_status_update: true,
      created_at_utc: now,
      updated_at_utc: now,
    },
  })

  for (const [index, status] of DEFAULT_STATUSES.entries()) {
    const swimlaneId = seedId(
      'swimlane',
      'bootstrap',
      title.toLowerCase(),
      DEFAULT_BOARD_NAME,
      status.name,
    )
    await prisma.board_swimlanes.upsert({
      where: { id: swimlaneId },
      update: {},
      create: {
        id: swimlaneId,
        board_id: boardId,
        status_id: seedId('status', 'bootstrap', title.toLowerCase(), status.name),
        display_order: index,
      },
    })
  }
}

/**
 * The organization's first Org Admin, when one is configured.
 *
 * This is the product's own answer to who administers a new organization, not an invention.
 * Self-registration always produces role `User` (`SPEC/20-feature-auth.md` requirement 17,
 * org-and-users requirement #4) and nothing promotes the first member, so the only route to an Org
 * Admin is org-and-users "Direct creation by an admin" #1: *Site Admin can add users to any
 * organization*, choosing the role and issuing an initial password. That is `POST
 * /organizations/:id/users`, which has no UI yet - this does the same thing against the same
 * columns, with the same forced password change on first login.
 *
 * The password is generated by the domain's own `generateTemporaryPassword`, printed once here, and
 * written nowhere. No expiry is set, matching the Site Admin bootstrap: an expiring credential the
 * operator has to relay by hand is a credential that dies in a chat message over a weekend.
 */
async function provisionFirstOrgAdmin(
  prisma: PrismaClientType,
  organizationId: string,
  email: string,
  now: Date,
): Promise<void> {
  const normalized = normalizeEmail(email)

  // By normalized email rather than by the derived id: an account created some other way still owns
  // the address, and the unique index on it would fail the insert.
  const existing = await prisma.users.findUnique({
    where: { normalized_email: normalized },
    select: { role: true, organization_id: true },
  })
  if (existing) {
    // Never re-issued. Minting a fresh password for whoever owns a configured address would make
    // this script an account-takeover path for anyone able to set an environment variable, and
    // re-running it would silently invalidate a password the administrator had already changed.
    console.log(
      `${email} already exists (role ${existing.role}${
        existing.organization_id === organizationId ? ', in this organization' : ''
      }) - left untouched, including its password.`,
    )
    return
  }

  const temporaryPassword = generateTemporaryPassword()
  await prisma.users.create({
    data: {
      id: seedId('user', 'bootstrap-org-admin', normalized),
      organization_id: organizationId,
      first_name: 'Org',
      last_name: 'Administrator',
      email,
      normalized_email: normalized,
      password_hash: new Pbkdf2PasswordHasher().hash(temporaryPassword),
      role: 'OrgAdmin',
      status: 'Active',
      must_change_password: true,
      failed_login_count: 0,
      security_stamp: randomUUID(),
      created_at_utc: now,
      updated_at_utc: now,
    },
  })

  console.log(
    `\ncreated Org Admin ${email}\n` +
      `  temporary password: ${temporaryPassword}\n` +
      '  Printed once and stored nowhere. Hand it over out of band; it must be changed on first ' +
      'login.\n',
  )
}

function printJoiningInstructions(title: string, inviteCode: string): void {
  console.log(
    `\nInvite code for '${title}': ${inviteCode}\n\n` +
      'This is how people get in. Give it to anyone who should join, and have them open /register ' +
      'on the web app and enter it with their name, email and a password of their own. They join ' +
      `'${title}' with the User role, which can create ideas on the default '${DEFAULT_BOARD_NAME}' ` +
      'board and move them between statuses.\n\n' +
      'Treat the code as shared-secret-shaped: anyone holding it can create an account. An Org ' +
      'Admin can replace it at any time from the organization settings, which invalidates the old ' +
      'one.\n',
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
