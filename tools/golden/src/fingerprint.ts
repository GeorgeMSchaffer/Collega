// Is the target database in the state the corpus was recorded against?
//
// The corpus covers mutating endpoints, so it is order-dependent and assumes a
// freshly seeded database on both sides. Replay it against a database that has
// already run it once and the diffs are real but meaningless: a profile the
// corpus itself renamed, users a previous import created. That failure list
// reads like a broken stack and costs an afternoon.
//
// So capture records a fingerprint of the pristine state before any scenario
// runs, and replay checks it before running anything. One clear sentence beats
// six confusing diffs.

import { createHash } from "node:crypto";
import type { Runner } from "./runner.ts";

/** List endpoints answer with a paged envelope; a few return the array directly. */
function rows(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const items = (payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : null;
}

/** Reads the seeded shape through the API — the harness speaks HTTP, not SQL. */
export async function fingerprint(runner: Runner): Promise<string> {
  const organizations = rows(await runner.get("/organizations", "SiteAdmin"));
  if (organizations === null) return "unavailable";

  const parts: string[] = [];
  const sorted = [...organizations].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  for (const organization of sorted) {
    const users = rows(await runner.get(`/organizations/${organization.organizationId}/users`, "SiteAdmin"));
    // Names are in the roster on purpose: the corpus renames a profile, so a
    // second run against the same database is exactly what this must catch.
    const roster =
      users === null
        ? "?"
        : users.map((u) => `${u.email}:${u.role}:${u.firstName ?? ""}`).sort().join(",");
    parts.push(`${organization.title}[${roster}]`);
  }

  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

export function explainMismatch(recorded: string, actual: string): string {
  return [
    `The target is not in the state this corpus was recorded against.`,
    `  recorded against: ${recorded}`,
    `  found:            ${actual}`,
    "",
    "The corpus covers mutating endpoints, so both capture and replay start from a",
    "freshly seeded database. The usual cause is replaying against a database this",
    "corpus has already run against once — its own renames and imports are still there.",
    "",
    "Reset and re-seed the target, then replay again. Pass --skip-seed-check to run",
    "anyway, and read every diff knowing some of them are yesterday's writes.",
  ].join("\n");
}
