import { members } from '@/lib/mock'
import { roleLabel } from '@/lib/roles'
import { type CurrentUser, type Role, setCurrentUser } from '@/lib/session'

/**
 * Switches the signed-in identity for one test.
 *
 * Identity used to be a module-level object a test could write through; it is resolved per request
 * now, so a test publishes one the same way the desk layout does — `setCurrentUser`. Outside a
 * request there is no request scope, and `lib/session.ts` falls back to a process-wide holder for
 * exactly this case. The setup file restores the default after every test, which is what keeps
 * these independent.
 *
 * The identities below are taken from the demo seed rather than invented. A fixture the real client
 * could never produce is how this repo has previously shipped a green test over a dead feature, so
 * a role's whole identity is switched together — `organizationName` included — never just its role.
 */
const HOME_ORGANIZATION = 'acme-robotics'

/**
 * A Site Admin has no row in `members`: the seed puts an Org Admin, two Users and a Read Only
 * account in each organization and no Site Admin in either. That is the point of the role — it is
 * a deployment account outside every organization — so `organizationId` and `organizationName` are
 * null, the branch `nav/sidebar.tsx` and the settings hub already write for it. `role-matrix.test.ts`
 * asserts this premise so the fixture cannot quietly drift away from the seed.
 */
const SITE_ADMIN: CurrentUser = {
  userId: 'demo-site-admin',
  displayName: 'Sam Deployment',
  initials: 'SD',
  role: 'SiteAdmin',
  roleLabel: 'Site Admin',
  organizationId: null,
  organizationName: null,
  viewingAs: null,
}

function identityFor(role: Role): CurrentUser {
  if (role === 'SiteAdmin') return SITE_ADMIN

  const member = members.find(
    (candidate) => candidate.organizationId === HOME_ORGANIZATION && candidate.role === role,
  )
  if (!member) {
    throw new Error(
      `The demo seed has no ${role} in ${HOME_ORGANIZATION}, so no honest fixture exists for it.`,
    )
  }

  return {
    userId: member.id,
    displayName: member.displayName,
    initials: member.initials,
    role: member.role,
    roleLabel: roleLabel(member.role),
    organizationId: member.organizationId,
    organizationName: member.organizationName,
    viewingAs: null,
  }
}

/** Sign in as `role` for the remainder of the current test. */
export function actAs(role: Role): void {
  setCurrentUser(identityFor(role))
}

/** The identity a test starts from unless it says otherwise. */
export function restoreCurrentUser(): void {
  setCurrentUser(identityFor('OrgAdmin'))
}
