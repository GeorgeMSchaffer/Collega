import type { Assignee, Priority, Role } from "@/lib/types";

/** What the sidebar and the account block call each role. */
export const ROLE_LABELS: Record<Role, string> = {
  SiteAdmin: "Site Admin",
  OrgAdmin: "Org Admin",
  User: "Member",
  ReadOnly: "Read Only",
};

/**
 * Initials for an avatar.
 *
 * `20-feature-client-ui.md`: first-name and last-name initial; if one part is missing use
 * the one that is there; if both are, `?` with an accessible label of *Unknown user*.
 */
export function initialsOf(first: string | null, last: string | null): string {
  const a = first?.trim()?.[0] ?? "";
  const b = last?.trim()?.[0] ?? "";
  const joined = `${a}${b}`.toUpperCase();
  return joined.length > 0 ? joined : "?";
}

export function assigneeName(assignee: Assignee): string {
  const parts = [assignee.firstName, assignee.lastName].filter(Boolean).join(" ").trim();
  return assignee.displayName?.trim() || parts || "Unknown user";
}

/**
 * Submission age as a viewer-local calendar-day difference, clamped at zero so a clock skew
 * cannot produce "-1 days ago".
 */
export function daysAgo(createdAtUtc: string, now: Date = new Date()): string {
  const created = new Date(createdAtUtc);
  const startOf = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.max(0, Math.round((startOf(now) - startOf(created)) / 86_400_000));
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function shortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}

/**
 * Priority has no colour in the API — it is an enum, not a configured entity — so the
 * mapping lives here. Every place it is drawn writes the word beside the dot, so the colour
 * is redundant by design (`SPEC/decisions.md` 2026-08-31).
 */
export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: "var(--muted-foreground)",
  Medium: "var(--teal)",
  High: "var(--sky)",
  Critical: "var(--orange)",
};
