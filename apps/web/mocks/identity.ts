/**
 * Who the app is pretending to be.
 *
 * The golden corpus records every case against one of five identities — the four product
 * roles plus anonymous — in its `as` field, and the router matches on that value verbatim.
 * So these strings are not ours to choose: they are the corpus's, and a typo here is a
 * fixture that can never be found.
 */

import type { Role } from "@collega/design-system";

/** The four product roles, in the order the corpus and the design system name them. */
export const MOCK_ROLES = ["SiteAdmin", "OrgAdmin", "User", "ReadOnly"] as const satisfies readonly Role[];

export type MockRole = (typeof MOCK_ROLES)[number];

/** Every identity the corpus recorded against, signed-out included. */
export const MOCK_IDENTITIES = ["anonymous", ...MOCK_ROLES] as const;

export type MockIdentity = (typeof MOCK_IDENTITIES)[number];

type AssertNever<T extends never> = T;

/**
 * The role list above and the design system's `Role` have to stay the same set, and they
 * are written out twice because apps/web may not import the corpus's own types and the
 * design system is frozen. `satisfies` above pins one direction; this pins the other, and
 * stops compiling the day a role is added to the design system and not to the mock.
 */
export type EveryDesignSystemRoleIsMocked = AssertNever<Exclude<Role, MockRole>>;

export function isMockIdentity(value: string | null | undefined): value is MockIdentity {
  return value != null && (MOCK_IDENTITIES as readonly string[]).includes(value);
}

/**
 * The identity travels two ways, and the router reads both.
 *
 * The cookie is the durable one: it rides on every same-origin request the browser makes,
 * including documents and server-component fetches, without anything having to remember to
 * attach it. The header is the explicit one, for callers that build their own request and
 * for the day the base URL points at another origin, where a cookie would not follow.
 */
export const MOCK_IDENTITY_COOKIE = "collega.mock.identity";
export const MOCK_IDENTITY_HEADER = "x-collega-mock-identity";

/** localStorage key behind the switcher, so a reload keeps the chosen identity. */
export const MOCK_IDENTITY_STORAGE_KEY = "collega.mock.identity";

/**
 * OrgAdmin, because it is the identity the corpus covers most thoroughly (111 of 447
 * cases) and so the one that leaves the fewest screens with nothing to show.
 */
export const DEFAULT_MOCK_IDENTITY: MockIdentity = "OrgAdmin";
