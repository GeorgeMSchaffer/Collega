/**
 * Who is signed in, and what their role permits.
 *
 * Deliberately **synchronous**, unlike everything in `lib/data/`. Identity is resolved once at the
 * request boundary — today from a fixture, after Wave D from the httpOnly session cookie the Nest
 * host issues (`SPEC/decisions.md` 2026-09-04, ticket 08) — not fetched per query. Making it a
 * promise would force every role-gated component to become async, including the client ones that
 * cannot await, and `Denied` renders inside several of those.
 *
 * That is the line this module draws: `lib/data/` is where the network will be, and this is not.
 */

export type { CurrentUser, Role } from './mock.js'
export {
  currentUser,
  deliveryAdminDenial,
  engagementDenial,
  isAdministrator,
  writeDenial,
} from './mock.js'
