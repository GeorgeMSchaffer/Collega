// Coverage of the corpus against the endpoint inventory.
//
// "If it is thin, the whole strategy is thin" (SPEC/50-typescript-migration.md,
// slice A2). Thin is only visible if something counts, so this does.

import { ROLES, type Endpoint, type Role } from "./inventory.ts";

export type Cell = { endpoint: string; role: Role | "anonymous"; kinds: string[] };

export type CoverageReport = {
  endpoints: number;
  covered: number;
  /** Endpoints with no case at all — the corpus does not pin them. */
  untouched: string[];
  /** Endpoints reached by some roles but not all the ones authorization admits. */
  partialRoles: { endpoint: string; missing: (Role | "anonymous")[] }[];
  /** Endpoints with only happy-path cases. Authorization and validation are behaviour too. */
  successOnly: string[];
  cells: Cell[];
};

/** Roles a corpus should exercise for this endpoint: those admitted, plus one that is not. */
export function expectedRoles(endpoint: Endpoint): (Role | "anonymous")[] {
  if (endpoint.authorize === "anonymous") return ["anonymous"];
  // A bare [Authorize] admits every role; a role list admits its own, and the
  // rest are worth recording precisely because their refusal is the contract.
  return [...ROLES, "anonymous"];
}

export function report(
  endpoints: Endpoint[],
  cases: { endpoint: string; role: Role | "anonymous"; kind: string }[],
): CoverageReport {
  const byEndpoint = new Map<string, Map<string, Set<string>>>();
  for (const c of cases) {
    const roles = byEndpoint.get(c.endpoint) ?? new Map<string, Set<string>>();
    const kinds = roles.get(c.role) ?? new Set<string>();
    kinds.add(c.kind);
    roles.set(c.role, kinds);
    byEndpoint.set(c.endpoint, roles);
  }

  const untouched: string[] = [];
  const partialRoles: CoverageReport["partialRoles"] = [];
  const successOnly: string[] = [];
  const cells: Cell[] = [];

  for (const endpoint of endpoints) {
    const roles = byEndpoint.get(endpoint.id);
    if (!roles || roles.size === 0) {
      untouched.push(endpoint.id);
      continue;
    }
    const missing = expectedRoles(endpoint).filter((role) => !roles.has(role));
    if (missing.length > 0) partialRoles.push({ endpoint: endpoint.id, missing });

    const kinds = new Set<string>();
    for (const [role, roleKinds] of roles) {
      cells.push({ endpoint: endpoint.id, role: role as Role | "anonymous", kinds: [...roleKinds].sort() });
      for (const kind of roleKinds) kinds.add(kind);
    }
    if (kinds.size === 1 && kinds.has("success")) successOnly.push(endpoint.id);
  }

  return {
    endpoints: endpoints.length,
    covered: endpoints.length - untouched.length,
    untouched,
    partialRoles,
    successOnly,
    cells: cells.sort((a, b) => a.endpoint.localeCompare(b.endpoint) || a.role.localeCompare(b.role)),
  };
}

export function formatReport(r: CoverageReport): string {
  const lines = [`coverage: ${r.covered}/${r.endpoints} endpoints have at least one case`];
  if (r.untouched.length > 0) {
    lines.push(`\nno case at all (${r.untouched.length}):`);
    for (const id of r.untouched) lines.push(`  ${id}`);
  }
  if (r.partialRoles.length > 0) {
    lines.push(`\nmissing roles (${r.partialRoles.length}):`);
    for (const { endpoint, missing } of r.partialRoles) lines.push(`  ${endpoint} — ${missing.join(", ")}`);
  }
  if (r.successOnly.length > 0) {
    lines.push(`\nhappy path only, no refusal or validation case (${r.successOnly.length}):`);
    for (const id of r.successOnly) lines.push(`  ${id}`);
  }
  return lines.join("\n");
}
