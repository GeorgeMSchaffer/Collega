import { type CurrentUser, currentUser, members, type Role } from '@/lib/mock'

/**
 * Switches the signed-in identity for one test.
 *
 * `lib/mock.ts` exports `currentUser` as a module-level object and every gated component reads
 * `currentUser.role` while rendering, so a test changes roles by writing to that object. The setup
 * file restores it after every test, which is what keeps these independent.
 *
 * The identities below are taken from the demo seed rather than invented. A fixture the real client
 * could never produce is how this repo has previously shipped a green test over a dead feature, so
 * a role's whole identity is switched together — `organizationName` included — never just its role.
 */
const HOME_ORGANIZATION = 'acme-robotics'

const ORIGINAL_CURRENT_USER: CurrentUser = { ...currentUser }

/**
 * A Site Admin has no row in `members`: the seed puts an Org Admin, two Users and a Read Only
 * account in each organization and no Site Admin in either. That is the point of the role — it is
 * a deployment account outside every organization — so `organizationName` is null, the branch
 * `nav/sidebar.tsx` and the settings hub already write for it. `role-matrix.test.ts` asserts this
 * premise so the fixture cannot quietly drift away from the seed.
 */
const SITE_ADMIN: CurrentUser = {
  displayName: 'Sam Deployment',
  initials: 'SD',
  role: 'SiteAdmin',
  roleLabel: 'Site Admin',
  organizationName: null,
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
    displayName: member.displayName,
    initials: member.initials,
    role: member.role,
    roleLabel: member.roleLabel,
    organizationName: member.organizationName,
  }
}

/** Sign in as `role` for the remainder of the current test. */
export function actAs(role: Role): void {
  Object.assign(currentUser, identityFor(role))
}

export function restoreCurrentUser(): void {
  Object.assign(currentUser, ORIGINAL_CURRENT_USER)
}
