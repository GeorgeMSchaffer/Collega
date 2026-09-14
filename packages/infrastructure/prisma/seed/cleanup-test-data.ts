/**
 * Removes what the test suites left behind in a development database.
 *
 * ## Why this exists
 *
 * Until 2026-09-14 the Playwright suite ran against whatever `DATABASE_URL` named rather than the
 * throwaway schema its own setup rebuilt — `e2e/database-url.ts` records how — so every run wrote a
 * fresh organization, users, boards and ideas into the developer's own database. Twenty test
 * organizations had accumulated there, plus accounts and boards inside the *seeded* organizations,
 * because some specs create a user in Acme Robotics rather than an organization of their own.
 *
 * That leak is fixed. This clears the residue, once.
 *
 * ## Why not just drop the schema and re-seed
 *
 * It is the obvious answer and it is the wrong default: it discards anything the developer made by
 * hand alongside the seed, and gives them no way to see what was about to go. This deletes only
 * rows it can name as test data, and **prints them and stops unless told to commit**.
 *
 * ```
 * pnpm --filter @collega/infrastructure db:clean          # dry run, prints what it would delete
 * pnpm --filter @collega/infrastructure db:clean --commit # actually deletes
 * ```
 *
 * ## What counts as test data
 *
 * Only these shapes, all of which are literals in the specs (`e2e/tests/*.spec.ts`):
 *
 * - organizations titled `Journey Co <timestamp>` or `Playwright Industries <timestamp>`
 * - users at `@journey.test`, or named `rotates.*` / `new.person.*` in a seeded organization
 * - boards called `Journey Board <timestamp>` or `Demo Board <timestamp>`
 * - ideas titled `Journey idea <timestamp>`
 *
 * **A trailing timestamp is required**, which is what keeps this from matching a real board somebody
 * happened to call "Demo Board". Everything owned by a matched organization goes with it.
 *
 * Renamed seeded rows are deliberately NOT matched. Step 10 renames a status to `Renamed <ts>` and
 * step 11 an idea type to `Type <ts>`; those are seeded rows wearing a new name, so deleting them
 * would remove catalog entries the demo needs. `db:seed` puts the names back — which it could not
 * do until the catalog upserts stopped passing `update: {}` on 2026-09-14.
 */

import { PrismaClient } from '../../src/generated/prisma/client.js'
import { loadRepositoryEnv } from './repository-env.ts'

/** `<name> <13-digit epoch>` — `Date.now()` is what every spec suffixes with. */
const STAMPED = (prefix: string) => new RegExp(`^${prefix} \\d{13}$`)

const TEST_ORGANIZATION = [STAMPED('Journey Co'), STAMPED('Playwright Industries')]
const TEST_BOARD = [STAMPED('Journey Board'), STAMPED('Demo Board')]
const TEST_IDEA = [STAMPED('Journey idea')]
const TEST_EMAIL = /^(journey\.\w+\.\d{13}@journey\.test|rotates\.\d{13}@|new\.person\.\d{13}@)/

const commit = process.argv.includes('--commit')

/**
 * Refuses anything but a database on this machine.
 *
 * The same rule `tools/local/start.ts` and `e2e/global-setup.ts` both apply, and for a stronger
 * reason here: this deletes rows rather than creating them, and the staging and production
 * databases are reachable from a laptop with the wrong variable exported. There is deliberately no
 * opt-out.
 */
function refuseIfNotLocal(url: string): void {
  const host = new URL(url).hostname
  if (host === 'localhost' || host === '::1' || host.startsWith('127.')) return
  throw new Error(
    `Refusing to clean a database at ${host}, which is not this machine.\n\n` +
      'This deletes rows. Point DATABASE_URL at a local database, or clean the remote one by hand.',
  )
}

async function main(): Promise<void> {
  loadRepositoryEnv()

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set.')
  refuseIfNotLocal(url)

  const prisma = new PrismaClient()
  try {
    const matches = (value: string, patterns: RegExp[]) => patterns.some((p) => p.test(value))

    const organizations = (
      await prisma.organizations.findMany({ select: { id: true, title: true } })
    ).filter((o) => matches(o.title, TEST_ORGANIZATION))
    const organizationIds = organizations.map((o) => o.id)

    // Two ways in: the organization is itself test data, or the account is test-shaped inside a
    // seeded one. The specs do both, so matching only the first would leave the accounts behind.
    const users = (
      await prisma.users.findMany({ select: { id: true, email: true, organization_id: true } })
    ).filter(
      (u) =>
        TEST_EMAIL.test(u.email) ||
        (u.organization_id !== null && organizationIds.includes(u.organization_id)),
    )
    const userIds = users.map((u) => u.id)

    const boards = (
      await prisma.boards.findMany({ select: { id: true, name: true, organization_id: true } })
    ).filter((b) => matches(b.name, TEST_BOARD) || organizationIds.includes(b.organization_id))
    const boardIds = boards.map((b) => b.id)

    const ideas = (
      await prisma.ideas.findMany({ select: { id: true, title: true, organization_id: true } })
    ).filter((i) => matches(i.title, TEST_IDEA) || organizationIds.includes(i.organization_id))
    const ideaIds = ideas.map((i) => i.id)

    console.log('Test data found:')
    console.log(`  organizations ${String(organizations.length)}`)
    console.log(`  users         ${String(users.length)}`)
    console.log(`  boards        ${String(boards.length)}`)
    console.log(`  ideas         ${String(ideas.length)}`)

    if (organizations.length + users.length + boards.length + ideas.length === 0) {
      console.log('\nNothing to clean.')
      return
    }

    if (!commit) {
      console.log('\nOrganizations that would go:')
      for (const o of organizations) console.log(`  ${o.title}`)
      console.log('\nAccounts that would go:')
      for (const u of users) console.log(`  ${u.email}`)
      console.log('\nDry run. Re-run with --commit to delete.')
      return
    }

    const org = { organization_id: { in: organizationIds } }
    const byIdea = { idea_id: { in: ideaIds } }

    // **Order is the foreign-key graph read backwards**, and every FK in this schema is restricted
    // rather than cascading - a deliberate choice, since an idea losing its author silently is worse
    // than a delete that refuses. So children go first, all the way down.
    const steps: [string, () => Promise<{ count: number }>][] = [
      [
        'comment_mentions',
        () => prisma.comment_mentions.deleteMany({ where: { comments: byIdea } }),
      ],
      ['comments', () => prisma.comments.deleteMany({ where: byIdea })],
      ['idea_assignees', () => prisma.idea_assignees.deleteMany({ where: byIdea })],
      ['idea_mentions', () => prisma.idea_mentions.deleteMany({ where: byIdea })],
      ['idea_upvotes', () => prisma.idea_upvotes.deleteMany({ where: byIdea })],
      ['idea_tags', () => prisma.idea_tags.deleteMany({ where: byIdea })],
      ['idea_field_values', () => prisma.idea_field_values.deleteMany({ where: byIdea })],
      ['issue_tasks', () => prisma.issue_tasks.deleteMany({ where: byIdea })],
      [
        'notification_events',
        () =>
          prisma.notification_events.deleteMany({
            where: { OR: [{ idea_id: { in: ideaIds } }, org] },
          }),
      ],
      ['ideas', () => prisma.ideas.deleteMany({ where: { id: { in: ideaIds } } })],
      [
        'board_swimlanes',
        () => prisma.board_swimlanes.deleteMany({ where: { board_id: { in: boardIds } } }),
      ],
      ['boards', () => prisma.boards.deleteMany({ where: { id: { in: boardIds } } })],
      [
        'idea_type_fields',
        () => prisma.idea_type_fields.deleteMany({ where: { idea_types: org } }),
      ],
      [
        'field_definition_options',
        () => prisma.field_definition_options.deleteMany({ where: { field_definitions: org } }),
      ],
      ['field_definitions', () => prisma.field_definitions.deleteMany({ where: org })],
      ['idea_types', () => prisma.idea_types.deleteMany({ where: org })],
      ['statuses', () => prisma.statuses.deleteMany({ where: org })],
      ['tags', () => prisma.tags.deleteMany({ where: org })],
      ['business_impacts', () => prisma.business_impacts.deleteMany({ where: org })],
      ['sprints', () => prisma.sprints.deleteMany({ where: org })],
      ['ai_usage_records', () => prisma.ai_usage_records.deleteMany({ where: org })],
      // Both ends reference users, so this has to clear before the accounts do.
      [
        'impersonation_sessions',
        () =>
          prisma.impersonation_sessions.deleteMany({
            where: {
              OR: [{ real_user_id: { in: userIds } }, { target_user_id: { in: userIds } }],
            },
          }),
      ],
      // Nullable columns, so the rows survive as history with the actor blanked - which is the
      // right answer for an audit trail, and the only one the restricted FK allows.
      [
        'audit_events (blanked)',
        async () => {
          const cleared = await prisma.audit_events.updateMany({
            where: { actor_user_id: { in: userIds } },
            data: { actor_user_id: null },
          })
          await prisma.audit_events.updateMany({
            where: { on_behalf_of_user_id: { in: userIds } },
            data: { on_behalf_of_user_id: null },
          })
          await prisma.audit_events.deleteMany({ where: org })
          return cleared
        },
      ],
      ['users', () => prisma.users.deleteMany({ where: { id: { in: userIds } } })],
      [
        'organizations',
        () => prisma.organizations.deleteMany({ where: { id: { in: organizationIds } } }),
      ],
    ]

    console.log('')
    for (const [table, run] of steps) {
      const { count } = await run()
      if (count > 0) console.log(`  ${table.padEnd(26)} ${String(count)}`)
    }

    console.log('\nDone.')
    console.log(
      'Statuses, idea types and boards the suite RENAMED are seeded rows and were left alone.\n' +
        'Run `pnpm --filter @collega/infrastructure db:seed` to put their names back.',
    )
  } finally {
    await prisma.$disconnect()
  }
}

await main()
