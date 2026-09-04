/**
 * The View As payloads, written from the golden corpus rather than generated —
 * `SPEC/30-Contracts.md` → "View As Contracts", recorded in `tools/golden/fixtures` as
 * `auth.viewas.*`. Only the fields the picker and the banner read are declared.
 */

import type { Me, Role } from "@/lib/types";

export type UserStatus = "Active" | "Inactive";

/** One row of `GET /auth/view-as/candidates`. */
export interface ViewAsCandidate {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly organizationId: string;
  readonly organizationName: string;
  /**
   * The server's own verdict on whether this row may be started, so the client never has to
   * reproduce the authorization rules (contract: `Inactive` users are listed but refused).
   * Recorded on every captured row; `status` is the fallback if a later capture drops it.
   */
  readonly selectable?: boolean;
}

/** The body of `POST /auth/view-as`. Both identities come back inline. */
export interface ViewAsStart {
  readonly impersonating: Me;
  readonly realUser: Me;
  readonly startedAtUtc: string;
  readonly expiresAtUtc: string;
}

/**
 * What `GET /auth/me` carries *only* while a session is live, and the field
 * `SPEC/30-Contracts.md` says the banner should be rendered from — precisely so an expired or
 * server-ended session cannot leave a stale banner behind.
 *
 * **No fixture in the corpus has ever carried it.** Every recorded `viewingAs` is `null`,
 * including the one inside the start response, because the capture ended its session before
 * re-reading `/auth/me`. So its *absence* cannot be treated as "the session ended" yet — that
 * would end every session the instant it began. It is read here and preferred wherever it
 * appears, which is what makes the switch to Nest a change of nothing but the data; ending the
 * session on its absence is the one line that goes in when a recording can show it.
 *
 * Declared here rather than on `Me` in `lib/types.ts` because that file belongs to the shell
 * slice and this field belongs to this one.
 */
export interface ViewingAs {
  readonly realUserId: string;
  readonly realUserName: string;
  readonly startedAtUtc: string;
  readonly expiresAtUtc: string;
}

export function viewingAsOf(me: Me | null): ViewingAs | null {
  return (me as (Me & { viewingAs?: ViewingAs | null }) | null)?.viewingAs ?? null;
}

export function candidateName(candidate: ViewAsCandidate): string {
  return `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email;
}

export function isSelectable(candidate: ViewAsCandidate): boolean {
  return candidate.selectable ?? candidate.status === "Active";
}
