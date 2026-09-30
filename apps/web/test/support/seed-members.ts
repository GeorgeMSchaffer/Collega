import type { Member, Role } from '@/lib/types'

/**
 * The demo seed's accounts: four per organization, one per role (see `demo.md`).
 *
 * Test data only. It used to live in `lib/mock.ts` beside the screens' fixtures; those are gone, and
 * this stays because `acting-role.ts` builds each role's whole identity from a row here rather than
 * inventing one, which is what keeps the unit tests' principals honest against the seed.
 */
const ROLE_SEED: ReadonlyArray<readonly [string, string, string, Role, string]> = [
  ['Olivia Administer', 'OA', 'orgadmin', 'OrgAdmin', 'Org Admin'],
  ['Noah Contributor', 'NC', 'user', 'User', 'User'],
  ['Maya Collaborator', 'MC', 'user2', 'User', 'User'],
  ['Rosa Observer', 'RO', 'readonly', 'ReadOnly', 'Read Only'],
]

const DEMO_ORGANIZATIONS: ReadonlyArray<readonly [string, string]> = [
  ['acme-robotics', 'Acme Robotics'],
  ['blue-harbor', 'Blue Harbor Logistics'],
]

export const members: Member[] = DEMO_ORGANIZATIONS.flatMap(([organizationId, organizationName]) =>
  ROLE_SEED.map(([displayName, initials, localPart, role, roleLabel], n) => ({
    id: `${organizationId}-u${n + 1}`,
    displayName,
    initials,
    email: `${localPart}@${organizationId}.demo.collega.test`,
    organizationId,
    organizationName,
    role,
    roleLabel,
    status: 'Active' as const,
  })),
)
