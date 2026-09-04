/**
 * The two product rules the settings screens exist to express, in one place.
 *
 * `SPEC/20-feature-view-as.md` rules 25 / 25a / 25b: a **Site Admin is refused every direct
 * mutation of organization-owned content** — boards, statuses, idea types, business impacts,
 * custom fields, ideas, comments, upvotes, delivery. View As is their only path to it.
 * Rule 26 is the **bootstrap exception**: organization and user administration stay direct,
 * because a new organization has nobody to impersonate yet.
 *
 * Why this is a module and not five `role === "SiteAdmin"` checks spread over the screens:
 * in the Blazor client the restriction was route-shaped, and route-shaped meant bypassable —
 * a later review found two more unguarded paths. Here the rule is asked at the point of the
 * *action*, every action asks the same function, and adding a surface without asking it is
 * visible in review as a mutating control that never consulted `mayMutate`.
 *
 * This is a UI convenience, never the authorization. The server decides, and its refusal is
 * what the screen renders when one arrives.
 */

import type { Role } from "@/lib/types";

/**
 * What a mutating control acts on.
 *
 *  - `org-content` — owned by an organization. Rule 25 refuses a Site Admin.
 *  - `bootstrap` — organizations themselves, and the accounts inside them. Rule 26 admits a
 *    Site Admin to every organization, including ones they are not a member of.
 *  - `own-profile` — the viewer's own name and password. Every role may.
 */
export type MutationScope = "org-content" | "bootstrap" | "own-profile";

/** Whether `role` may take a mutating action in `scope`. */
export function mayMutate(role: Role | undefined, scope: MutationScope): boolean {
  if (role === undefined) return false;
  switch (scope) {
    case "own-profile":
      return true;
    case "bootstrap":
      // Rule 26. An Org Admin administers their own organization's users; a Site Admin
      // administers organizations and the users of any of them.
      return role === "SiteAdmin" || role === "OrgAdmin";
    case "org-content":
      // Rule 25. Deliberately excludes SiteAdmin — that is the whole rule.
      return role === "OrgAdmin";
  }
}

/**
 * Why the control is refused, in the product's voice.
 *
 * These mirror what the API answers, which the corpus recorded verbatim:
 * `POST /organizations/{id}/statuses` as a Site Admin returns *"Site Admins cannot change
 * organization content directly. Use View As to act as a user in that organization."* The
 * sentence has to exist before any request is made — a disabled control explains itself on
 * focus, not after a round trip — so it is written here and the screens render the API's own
 * words on top of it whenever a request actually comes back refused.
 */
export function refusalReason(role: Role | undefined, scope: MutationScope): string | null {
  if (mayMutate(role, scope)) return null;
  if (scope === "org-content" && role === "SiteAdmin") {
    return "A Site Admin cannot change an organization’s content. Use View As to act as one of its members.";
  }
  if (role === "ReadOnly") return "Read-only accounts cannot change anything.";
  if (role === "User") return "This is an administrator’s job.";
  if (role === "OrgAdmin") return "Only a Site Admin can do this.";
  return "Your role cannot do this.";
}

/** Roles a settings route is open to at all. Anything else meets a refusal panel. */
export type RouteAudience = "everyone" | "administrators" | "site-admin" | "org-admin";

export function mayOpen(role: Role | undefined, audience: RouteAudience): boolean {
  if (role === undefined) return false;
  switch (audience) {
    case "everyone":
      return true;
    case "administrators":
      return role === "SiteAdmin" || role === "OrgAdmin";
    case "site-admin":
      return role === "SiteAdmin";
    case "org-admin":
      return role === "OrgAdmin";
  }
}
