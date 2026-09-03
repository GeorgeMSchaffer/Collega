// Scaffold a scenario stub for every endpoint × role.
//
// A2's work is filling in ids, bodies and bindings against a running API. What
// it should not also have to do is remember which of 81 endpoints × 4 roles it
// has not written yet — so the grid is generated, every cell marked `todo`, and
// capture refuses to record a cell still carrying the flag.

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROLES, type Endpoint, type Role } from "./inventory.ts";
import { expectedRoles } from "./coverage.ts";

const SUCCESS_BY_VERB: Record<string, number> = { POST: 201, DELETE: 204 };

/** The status this role should see, read from what the action declares it produces. */
function expectFor(endpoint: Endpoint, role: Role | "anonymous"): { kind: string; expect: number } {
  const declared = new Set(endpoint.statuses);
  const admitted =
    endpoint.authorize === "anonymous" ||
    endpoint.authorize === "any" ||
    (Array.isArray(endpoint.authorize) && endpoint.authorize.includes(role as Role));

  if (role === "anonymous" && endpoint.authorize !== "anonymous") {
    return { kind: "denied", expect: 401 };
  }
  if (!admitted) return { kind: "denied", expect: declared.has(403) ? 403 : 401 };

  const preferred = SUCCESS_BY_VERB[endpoint.verb];
  if (preferred !== undefined && declared.has(preferred)) return { kind: "success", expect: preferred };
  const success = [...declared].filter((s) => s >= 200 && s < 300).sort()[0];
  return { kind: "success", expect: success ?? 200 };
}

/** "boards.list" — stable, readable, and unique within a controller. */
function stepId(endpoint: Endpoint, role: Role | "anonymous"): string {
  return `${endpoint.action}.${role}`.toLowerCase();
}

export function scenarioFor(controller: string, endpoints: Endpoint[]) {
  const steps = endpoints.flatMap((endpoint) =>
    expectedRoles(endpoint).map((role) => {
      const { kind, expect } = expectFor(endpoint, role);
      return {
        id: stepId(endpoint, role),
        endpoint: endpoint.id,
        path: endpoint.route.replace(/\{(\w+)\}/g, "{{$1}}"),
        as: role,
        kind,
        expect,
        todo: true,
        ...(endpoint.verb === "GET" || endpoint.verb === "DELETE" ? {} : { body: {} }),
      };
    }),
  );

  return {
    name: controller.toLowerCase(),
    description:
      `${controller} — ${endpoints.length} endpoint(s) × ${ROLES.length} roles plus anonymous. ` +
      "Fill in paths, bodies and bindings, then remove each step's todo flag.",
    bind: {},
    steps,
  };
}

export async function scaffoldScenarios(
  endpoints: Endpoint[],
  dir: string,
  force: boolean,
): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const byController = new Map<string, Endpoint[]>();
  for (const endpoint of endpoints) {
    byController.set(endpoint.controller, [...(byController.get(endpoint.controller) ?? []), endpoint]);
  }

  const written: string[] = [];
  for (const [controller, group] of [...byController].sort()) {
    const file = path.join(dir, `${controller.toLowerCase()}.json`);
    if (!force) {
      // Never overwrite hand-filled work; that is a day of A2 gone.
      try {
        await access(file);
        continue;
      } catch {
        // absent, so write it
      }
    }
    await writeFile(file, `${JSON.stringify(scenarioFor(controller, group), null, 2)}\n`);
    written.push(path.basename(file));
  }
  return written;
}
