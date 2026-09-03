// Scenario files: what to ask the API, in what order, as whose.
//
// Scenarios are data, not code. Nothing in a scenario file is evaluated — the
// runner reads it, substitutes {{variables}} bound from earlier responses, and
// makes the request. That keeps the corpus reviewable and keeps a fixture from
// being able to do anything a reviewer would not expect.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ROLES, type HttpVerb, type Role } from "./inventory.ts";

export type Step = {
  /** Unique inside the scenario; names the fixture file. */
  id: string;
  /** Inventory id this exercises, e.g. "GET /boards/{boardId}". Drives coverage. */
  endpoint: string;
  /** Concrete path, with {{variables}} where ids go. Defaults to the endpoint's route. */
  path?: string;
  query?: Record<string, string>;
  body?: unknown;
  /** Raw body for non-JSON requests (CSV import). Mutually exclusive with body. */
  text?: string;
  contentType?: string;
  /** Who makes the request. "anonymous" sends no Authorization header. */
  as: Role | "anonymous";
  /** What this case is for: the happy path, a refusal, a validation failure. */
  kind: "success" | "denied" | "invalid" | "missing";
  /** Status the author expects. Capture warns loudly when the API disagrees. */
  expect: number;
  /** Response paths that differ every run and are dropped before comparison. */
  unstable?: string[];
  /** Bindings pulled out of the response for later steps: { boardId: "$.body.id" }. */
  bind?: Record<string, string>;
  /** Free-text note carried into the fixture, for whoever reads a failure later. */
  note?: string;
  /** Scaffolded but not yet filled in. Capture skips these and exits non-zero. */
  todo?: boolean;
};

export type Scenario = {
  name: string;
  description?: string;
  /** Variables every step may use, resolved before the run (e.g. seed ids). */
  bind?: Record<string, string>;
  steps: Step[];
  file: string;
};

const KINDS = new Set(["success", "denied", "invalid", "missing"]);
const VERBS = new Set<HttpVerb>(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function validateScenario(raw: unknown, file: string): Scenario {
  const fail = (message: string): never => {
    throw new Error(`${file}: ${message}`);
  };
  if (!raw || typeof raw !== "object") fail("not an object");
  const s = raw as Record<string, unknown>;
  if (typeof s.name !== "string" || s.name === "") fail("missing name");
  if (!Array.isArray(s.steps) || s.steps.length === 0) fail("no steps");

  const seen = new Set<string>();
  for (const [index, rawStep] of (s.steps as unknown[]).entries()) {
    const where = `${s.name}.step[${index}]`;
    if (!rawStep || typeof rawStep !== "object") fail(`${where} is not an object`);
    const step = rawStep as Record<string, unknown>;
    const id = step.id;
    if (typeof id !== "string" || id === "") fail(`${where} missing id`);
    if (seen.has(id as string)) fail(`${where} duplicate id "${id}"`);
    seen.add(id as string);
    if (typeof step.endpoint !== "string") fail(`${where} missing endpoint`);
    const verb = (step.endpoint as string).split(" ")[0] as HttpVerb;
    if (!VERBS.has(verb)) fail(`${where} endpoint must start with a verb`);
    if (step.as !== "anonymous" && !ROLES.includes(step.as as Role)) {
      fail(`${where} "as" must be anonymous or one of ${ROLES.join(", ")}`);
    }
    if (typeof step.kind !== "string" || !KINDS.has(step.kind)) {
      fail(`${where} kind must be one of ${[...KINDS].join(", ")}`);
    }
    if (typeof step.expect !== "number") fail(`${where} missing expect`);
    if (step.body !== undefined && step.text !== undefined) {
      fail(`${where} sets both body and text`);
    }
  }
  return { ...(s as unknown as Scenario), file };
}

export async function loadScenarios(dir: string): Promise<Scenario[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const scenarios: Scenario[] = [];
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`${file}: not valid JSON — ${(error as Error).message}`);
    }
    scenarios.push(validateScenario(parsed, file));
  }
  const names = new Set<string>();
  for (const scenario of scenarios) {
    if (names.has(scenario.name)) throw new Error(`two scenarios named "${scenario.name}"`);
    names.add(scenario.name);
  }
  return scenarios;
}

/** Replace every {{name}} in a string, object, or array from the bindings. */
export function interpolate(input: unknown, vars: Map<string, unknown>): unknown {
  if (typeof input === "string") {
    // A lone "{{x}}" keeps x's type; embedded ones stringify.
    const whole = /^\{\{(\w+)\}\}$/.exec(input);
    if (whole) return readVar(whole[1], vars);
    return input.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(readVar(name, vars)));
  }
  if (Array.isArray(input)) return input.map((item) => interpolate(item, vars));
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = interpolate(value, vars);
    }
    return out;
  }
  return input;
}

function readVar(name: string, vars: Map<string, unknown>): unknown {
  if (!vars.has(name)) {
    throw new Error(
      `unbound variable {{${name}}} — bind it in an earlier step or in the scenario's "bind"`,
    );
  }
  return vars.get(name);
}

/**
 * The pointer subset used by "bind": $.body.id, $.body[0].id, $.headers.location,
 * and $.body[*].id to collect a field from every element — which the reorder
 * endpoints need, since they demand the organization's full set of ids in one
 * request and refuse anything less.
 *
 * Deliberately not full JSONPath — a fixture corpus does not need a query language.
 */
export function pluck(pointer: string, source: { body: unknown; headers: Record<string, string> }) {
  if (!pointer.startsWith("$.")) throw new Error(`bind pointer must start with "$.": ${pointer}`);
  const segments = pointer
    .slice(2)
    .replace(/\[(\d+|\*)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  const value = walk(segments, source, pointer);
  if (value === undefined) throw new Error(`bind pointer ${pointer} resolved to undefined`);
  return value;
}

function walk(segments: string[], node: unknown, pointer: string): unknown {
  if (segments.length === 0) return node;
  if (node === null || node === undefined) {
    throw new Error(`bind pointer ${pointer} hit ${String(node)} at "${segments[0]}"`);
  }
  const [head, ...rest] = segments;

  if (head === "*") {
    if (!Array.isArray(node)) throw new Error(`bind pointer ${pointer} used [*] on a non-array`);
    return node.map((item) => walk(rest, item, pointer));
  }
  if (Array.isArray(node)) return walk(rest, node[Number(head)], pointer);
  if (typeof node !== "object") throw new Error(`bind pointer ${pointer} ran past a leaf`);
  return walk(rest, (node as Record<string, unknown>)[head], pointer);
}
