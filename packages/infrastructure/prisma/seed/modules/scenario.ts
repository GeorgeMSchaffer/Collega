import { createHash } from 'node:crypto'

/**
 * The demo scenario, and the identifiers derived from it.
 *
 * Ported from the frozen `src/Collega.Infrastructure/Seeding/StartupSeeder.cs`, which is the only
 * record of what the demo data actually was - the database it produced is the one remaining copy,
 * and it cannot be rebuilt from itself. The shape is fixed by the definition of done: 2
 * organizations, 10 users, 4 boards, 44 ideas.
 *
 * **Every upsert in these modules has an empty `update`.** A row that already exists is left
 * exactly as it is - the seed creates what is missing and mutates nothing. An earlier version
 * refreshed names and `updated_at_utc`, which meant a re-run silently changed every timestamp in
 * the database and two consecutive runs produced different response bodies: the opposite of the
 * reproducibility the derived ids below exist to buy, and something a golden fixture comparing a
 * timestamp would catch as a false diff. Changing the scenario data therefore needs a rebuild
 * (`dropdb`, `db:migrate`, `db:seed` - under four seconds), which is the sanctioned path anyway
 * per `SPEC/decisions.md` 2026-09-09.
 *
 * One deliberate change from the .NET seeder: **every id here is derived, not random.** That
 * seeder created GUIDs and made each step idempotent by re-querying on a natural key, which works
 * but leaves two seeded databases disagreeing about every id - so a golden fixture recorded
 * against one cannot be replayed against the other. Deriving ids from stable names makes the seed
 * reproducible across machines and turns idempotency into an `upsert` on the primary key.
 */

/** A fixed namespace, so ids are stable across runs but cannot collide with real data. */
const NAMESPACE = 'collega.demo.seed.v1'

/**
 * A UUID derived from a name (RFC 4122 §4.3, SHA-1, version 5). Same name in, same uuid out,
 * on any machine.
 */
export function seedId(...parts: readonly string[]): string {
  const digest = createHash('sha1')
    .update(`${NAMESPACE}:${parts.join(':')}`)
    .digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  // Version 5, RFC 4122 variant.
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6)
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8)
  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

export type DemoBoardScenario = {
  readonly name: string
  readonly focus: string
  readonly tagNames: readonly string[]
}

export type DemoOrganizationScenario = {
  readonly title: string
  readonly slug: string
  readonly description: string
  readonly boards: readonly DemoBoardScenario[]
}

/** The second demo board every organization gets, alongside the default `Ideas` board. */
export const SECOND_BOARD_NAME = 'Opportunities'

export const DEMO_ORGANIZATIONS: readonly DemoOrganizationScenario[] = [
  {
    title: 'Acme Robotics',
    slug: 'acme-robotics',
    description: 'Industrial robotics and automation manufacturer.',
    boards: [
      {
        name: 'Ideas',
        focus: 'Assembly cell reliability',
        tagNames: ['automation', 'safety', 'quality', 'cycle-time'],
      },
      {
        name: SECOND_BOARD_NAME,
        focus: 'Field service enablement',
        tagNames: ['service', 'diagnostics', 'customer-impact', 'parts'],
      },
    ],
  },
  {
    title: 'Blue Harbor Logistics',
    slug: 'blue-harbor',
    description: 'Regional freight and warehousing operator.',
    boards: [
      {
        name: 'Ideas',
        focus: 'Warehouse throughput',
        tagNames: ['warehouse', 'safety', 'inventory', 'cycle-time'],
      },
      {
        name: SECOND_BOARD_NAME,
        focus: 'Route and delivery performance',
        tagNames: ['routing', 'fleet', 'customer-impact', 'scheduling'],
      },
    ],
  },
]

export type DemoIdeaScenario = { readonly title: string; readonly description: string }

/** Eleven per board, which is what the 3/2/2/1/3 status distribution below sums to. */
export const IDEA_SCENARIOS: readonly DemoIdeaScenario[] = [
  {
    title: 'Reduce manual handoffs',
    description: 'Map the current handoffs and automate the highest-friction transition.',
  },
  {
    title: 'Add proactive alerts',
    description: 'Notify the responsible team before a preventable delay becomes customer-visible.',
  },
  {
    title: 'Standardize the intake checklist',
    description: 'Use one concise checklist so requests arrive complete and ready for action.',
  },
  {
    title: 'Pilot a faster review path',
    description: 'Trial a lightweight review path for low-risk changes and measure cycle time.',
  },
  {
    title: 'Improve exception visibility',
    description: 'Surface recurring exceptions with enough context for rapid ownership.',
  },
  {
    title: 'Automate weekly reporting',
    description: 'Generate the weekly operating summary from source data instead of spreadsheets.',
  },
  {
    title: 'Create a shared playbook',
    description:
      'Capture the approved response steps and escalation points in one maintained playbook.',
  },
  {
    title: 'Validate the customer feedback loop',
    description: 'Close the loop with requesters and record whether the change solved the problem.',
  },
  {
    title: 'Roll out the proven workflow',
    description: 'Extend the successful pilot to the remaining teams with clear adoption measures.',
  },
  {
    title: 'Measure time saved',
    description:
      'Compare the new workflow with the baseline and publish the verified time savings.',
  },
  {
    title: 'Retire the legacy step',
    description: 'Remove the superseded process step after confirming all dependencies have moved.',
  },
]

/**
 * How the eleven ideas spread across the five default statuses, in status order.
 * `SPEC/40-test-strategy.md` names this distribution and `apps/web`'s fixtures already honour it,
 * so the seed has to as well or the two disagree about what a board looks like.
 */
export const IDEAS_PER_STATUS: readonly number[] = [3, 2, 2, 1, 3]

/** The demo password for every seeded account. Development only - the seed refuses production. */
export const DEMO_PASSWORD = 'Abc123!'

/**
 * Development-only convenience Site Admin. Distinct from the environment-configured Site Admin so
 * seeding never disturbs that account, and not forced to change its password, so the platform-admin
 * perspective can be exercised without the configured secret.
 */
export const DEMO_SITE_ADMIN_EMAIL = 'siteadmin@demo.collega.test'

export type DemoAccount = {
  readonly firstName: string
  readonly lastName: string
  /** Local part; the domain is derived from the organization slug. */
  readonly localPart: string
  readonly role: 'OrgAdmin' | 'User' | 'ReadOnly'
}

/**
 * One account per role per organization. The two `User` accounts exist because an idea needs an
 * author who is not the administrator; the Read Only account authors nothing, and exists because
 * the golden capture needs an account for all four roles.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { firstName: 'Olivia', lastName: 'Administer', localPart: 'orgadmin', role: 'OrgAdmin' },
  { firstName: 'Noah', lastName: 'Contributor', localPart: 'user', role: 'User' },
  { firstName: 'Maya', lastName: 'Collaborator', localPart: 'user2', role: 'User' },
  { firstName: 'Rosa', lastName: 'Observer', localPart: 'readonly', role: 'ReadOnly' },
]

/**
 * Org Admin plus the two Users, in the rotation order every author, assignee, upvote and comment
 * index below is taken modulo. Read Only is excluded: it authors nothing.
 *
 * ORDER IS LOAD-BEARING, and `user2` before `user` is not a typo. `StartupSeeder` read the
 * contributors as `OrderBy(Role == OrgAdmin ? 0 : 1).ThenBy(Email)`, and `user2@...` sorts before
 * `user@...` because `2` precedes `@`. The golden corpus agrees: idea 1's author is `user2@`.
 */
export const CONTRIBUTOR_LOCAL_PARTS: readonly string[] = ['orgadmin', 'user2', 'user']

export function demoEmail(localPart: string, slug: string): string {
  return `${localPart}@${slug}.demo.collega.test`
}
