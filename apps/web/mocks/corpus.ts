/**
 * The corpus, read as data.
 *
 * `tools/golden/fixtures` holds 447 exchanges recorded from the live .NET API on
 * 2026-09-03, one JSON file per case, plus a manifest naming the 81 endpoints. The files
 * are the source of truth and are read from disk at request time rather than copied or
 * generated into this app: a second copy would go stale the first time the corpus is
 * re-captured, and a stale recording is worse than no recording.
 *
 * Nothing here imports `tools/golden`'s own modules — that is a separate npm island with
 * its own toolchain, and apps/web may not depend on it. This reads the JSON, and only the
 * fields it needs.
 *
 * Server-side only: it touches the filesystem.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { MOCK_FIXTURES_DIR } from "./config";
import { type MockIdentity, isMockIdentity } from "./identity";

/** The four case kinds the corpus's scenario format declares. */
export const CASE_KINDS = ["success", "denied", "invalid", "missing"] as const;
export type CaseKind = (typeof CASE_KINDS)[number];

export interface FixtureRequest {
  readonly method: string;
  /** Concrete path, relative to the corpus base path `/api/v1`. Never carries a query. */
  readonly path: string;
  /**
   * The query the case was recorded with, canonicalized — recovered from the scenario, not
   * from the fixture, which does not keep it. Empty for the 437 cases that had none.
   */
  readonly query: string;
  readonly body: unknown;
  readonly contentType?: string;
}

export interface FixtureResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** Object, array, string (CSV) or null (204). Served as recorded. */
  readonly body: unknown;
}

export interface Fixture {
  /** Corpus file name, which is how a response points back at what it came from. */
  readonly file: string;
  readonly scenario: string;
  readonly step: string;
  /** Templated endpoint id, e.g. `GET /boards/{boardId}/ideas`. */
  readonly endpoint: string;
  readonly as: MockIdentity;
  readonly kind: CaseKind;
  readonly note?: string;
  readonly request: FixtureRequest;
  readonly response: FixtureResponse;
  /** Bytes of recorded response body — the tie-break when one case was recorded twice. */
  readonly weight: number;
}

/**
 * A query string in the one form two of them can be compared in: parameters sorted by name,
 * then by value, and re-encoded. `?b=2&a=1` and `?a=1&b=2` are the same request.
 */
export function canonicalQuery(query: string | Readonly<Record<string, string>>): string {
  const params = typeof query === "string" ? new URLSearchParams(query) : new URLSearchParams(query);
  const entries = [...params.entries()].sort((left, right) =>
    left[0] === right[0] ? left[1].localeCompare(right[1]) : left[0].localeCompare(right[0]),
  );
  return new URLSearchParams(entries).toString();
}

/** One endpoint from the manifest, split for matching. */
export interface EndpointTemplate {
  readonly id: string;
  readonly method: string;
  readonly segments: readonly string[];
  /** How many segments are literal. More literal segments wins a two-way match. */
  readonly literals: number;
}

export interface Corpus {
  readonly dir: string;
  readonly capturedAt: string;
  readonly basePath: string;
  readonly endpoints: readonly EndpointTemplate[];
  readonly fixtures: readonly Fixture[];
  /** `METHOD /concrete/path` + identity — the recorded request, matched verbatim. */
  readonly byConcrete: ReadonlyMap<string, readonly Fixture[]>;
  /** Templated endpoint id + identity — the fallback when the ids differ. */
  readonly byEndpoint: ReadonlyMap<string, readonly Fixture[]>;
  /** Which identities an endpoint was recorded at, for naming the gap in a refusal. */
  readonly identitiesByEndpoint: ReadonlyMap<string, readonly MockIdentity[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function weigh(body: unknown): number {
  if (body === null || body === undefined) return 0;
  if (typeof body === "string") return body.length;
  return JSON.stringify(body).length;
}

function parseEndpoint(id: string): EndpointTemplate | null {
  const space = id.indexOf(" ");
  if (space < 0) return null;
  const method = id.slice(0, space);
  const segments = id
    .slice(space + 1)
    .split("/")
    .filter((segment) => segment.length > 0);
  const literals = segments.filter((segment) => !segment.startsWith("{")).length;
  return { id, method, segments, literals };
}

/**
 * A fixture file, validated only as far as the router relies on it. A file that does not
 * carry the shape is dropped with a warning rather than crashing the app — but a corpus
 * that starts dropping cases is a corpus that has changed shape, so the warning matters.
 */
function parseFixture(file: string, raw: unknown, queries: ReadonlyMap<string, string>): Fixture | null {
  if (!isRecord(raw)) return null;
  const { endpoint, as, kind, scenario, step, request, response } = raw;
  if (typeof endpoint !== "string" || !isMockIdentity(typeof as === "string" ? as : null)) return null;
  if (typeof kind !== "string" || !(CASE_KINDS as readonly string[]).includes(kind)) return null;
  if (!isRecord(request) || !isRecord(response)) return null;
  if (typeof request.method !== "string" || typeof request.path !== "string") return null;
  if (typeof response.status !== "number") return null;

  const headers = isRecord(response.headers)
    ? Object.fromEntries(
        Object.entries(response.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      )
    : {};

  return {
    file,
    scenario: typeof scenario === "string" ? scenario : "",
    step: typeof step === "string" ? step : "",
    endpoint,
    as: as as MockIdentity,
    kind: kind as CaseKind,
    note: typeof raw.note === "string" && raw.note.length > 0 ? raw.note : undefined,
    request: {
      method: request.method.toUpperCase(),
      path: request.path,
      query: queries.get(`${String(scenario)} ${String(step)}`) ?? "",
      body: request.body ?? null,
      contentType: typeof request.contentType === "string" ? request.contentType : undefined,
    },
    response: { status: response.status, headers, body: response.body ?? null },
    weight: weigh(response.body),
  };
}

/**
 * Find the corpus by walking up from the working directory. `next start` runs from
 * `apps/web`, `turbo` from the repository root, and a test runner from somewhere else
 * again, so an offset relative to any one of them would be wrong from the other two.
 */
async function holdsCorpus(dir: string): Promise<boolean> {
  try {
    await readFile(/* turbopackIgnore: true */ path.join(dir, "manifest.json"));
    return true;
  } catch {
    return false;
  }
}

async function findFixturesDir(): Promise<string> {
  if (MOCK_FIXTURES_DIR) {
    if (await holdsCorpus(MOCK_FIXTURES_DIR)) return MOCK_FIXTURES_DIR;
    throw new Error(
      `COLLEGA_MOCK_FIXTURES_DIR points at ${MOCK_FIXTURES_DIR}, which holds no manifest.json. ` +
        "The mock serves the golden corpus and has nothing to serve without it.",
    );
  }

  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "tools", "golden", "fixtures");
    if (await holdsCorpus(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `No tools/golden/fixtures found above ${process.cwd()}. The mock serves recordings from the ` +
      "golden corpus and has nothing to serve without them. Run from inside the repository, or set " +
      "COLLEGA_MOCK_FIXTURES_DIR.",
  );
}

/**
 * The one thing a fixture does not keep about its own request: the query string.
 *
 * `request.path` is written without it, so two cases recorded at the same path — the tag
 * list, and the tag list filtered by `?search=safe` — are indistinguishable in the corpus and
 * collapse onto one key. Answering the unfiltered request with the filtered recording is
 * precisely the quiet invention this mock must not do, and it is not hypothetical: it is what
 * `tags.suggest.orgadmin` and `tags.suggest.search.orgadmin` would do to a tag picker.
 *
 * The scenarios beside the fixtures still hold it, in each step's `query`, and a fixture
 * names its scenario and step. So the query is read back from there and put onto the fixture.
 * This reads the scenario files as data, exactly as it reads the fixtures — it does not
 * import the harness, whose code is a separate npm island.
 *
 * A scenario directory that is missing or unreadable costs only query fidelity, so it warns
 * and carries on with every case looking unfiltered.
 */
async function loadRecordedQueries(fixturesDir: string): Promise<Map<string, string>> {
  const dir = path.join(path.dirname(fixturesDir), "scenarios");
  const queries = new Map<string, string>();

  let files: string[];
  try {
    files = (await readdir(/* turbopackIgnore: true */ dir)).filter((file) => file.endsWith(".json"));
  } catch {
    console.warn(`[mock] No scenarios at ${dir}; recorded query strings cannot be recovered.`);
    return queries;
  }

  for (const file of files) {
    const raw: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ path.join(dir, file), "utf8"));
    if (!isRecord(raw) || typeof raw.name !== "string" || !Array.isArray(raw.steps)) continue;
    for (const step of raw.steps) {
      if (!isRecord(step) || typeof step.id !== "string" || !isRecord(step.query)) continue;
      const pairs = Object.entries(step.query).filter((entry): entry is [string, string] => typeof entry[1] === "string");
      if (pairs.length > 0) queries.set(`${raw.name} ${step.id}`, canonicalQuery(Object.fromEntries(pairs)));
    }
  }
  return queries;
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

async function loadCorpus(): Promise<Corpus> {
  const dir = await findFixturesDir();
  const manifestPath = path.join(dir, "manifest.json");
  const manifestRaw: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ manifestPath, "utf8"));
  if (!isRecord(manifestRaw) || !Array.isArray(manifestRaw.endpoints)) {
    throw new Error(`The corpus manifest at ${dir} does not name its endpoints.`);
  }

  const endpoints = manifestRaw.endpoints
    .filter((id): id is string => typeof id === "string")
    .map(parseEndpoint)
    .filter((endpoint): endpoint is EndpointTemplate => endpoint !== null);

  const files = (await readdir(/* turbopackIgnore: true */ dir))
    .filter((file) => file.endsWith(".json") && file !== "manifest.json")
    .sort();

  const queries = await loadRecordedQueries(dir);

  const fixtures: Fixture[] = [];
  const dropped: string[] = [];
  for (const file of files) {
    // The bundler cannot see through a path built at runtime, so it would otherwise trace the
    // entire repository into the server output. The corpus lives outside apps/web by design —
    // it is the capture harness's, not the app's — so the read stays dynamic and opts out.
    const raw: unknown = JSON.parse(
      await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir, file), "utf8"),
    );
    const fixture = parseFixture(file, raw, queries);
    if (fixture) fixtures.push(fixture);
    else dropped.push(file);
  }
  if (dropped.length > 0) {
    console.warn(`[mock] ${dropped.length} fixture file(s) did not parse and were skipped: ${dropped.join(", ")}`);
  }

  const byConcrete = new Map<string, Fixture[]>();
  const byEndpoint = new Map<string, Fixture[]>();
  const identities = new Map<string, Set<MockIdentity>>();
  for (const fixture of fixtures) {
    push(byConcrete, concreteKey(fixture.request.method, fixture.request.path, fixture.as), fixture);
    push(byEndpoint, endpointKey(fixture.endpoint, fixture.as), fixture);
    const seen = identities.get(fixture.endpoint) ?? new Set<MockIdentity>();
    seen.add(fixture.as);
    identities.set(fixture.endpoint, seen);
  }

  return {
    dir,
    capturedAt: typeof manifestRaw.capturedAt === "string" ? manifestRaw.capturedAt : "unknown",
    basePath: typeof manifestRaw.basePath === "string" ? manifestRaw.basePath : "/api/v1",
    endpoints,
    fixtures,
    byConcrete,
    byEndpoint,
    identitiesByEndpoint: new Map([...identities].map(([id, set]) => [id, [...set]])),
  };
}

export function concreteKey(method: string, requestPath: string, identity: MockIdentity): string {
  return `${method.toUpperCase()} ${requestPath} ${identity}`;
}

export function endpointKey(endpointId: string, identity: MockIdentity): string {
  return `${endpointId} ${identity}`;
}

let cached: Promise<Corpus> | undefined;

/**
 * Loaded once per process and held; the corpus is committed and does not change under us.
 *
 * A failed load is *not* held. The likely failures — a wrong `COLLEGA_MOCK_FIXTURES_DIR`, a
 * corpus that is not there yet — are the ones somebody fixes while the server is running, and
 * caching the rejection would leave them staring at the old error until they restarted.
 */
export function getCorpus(): Promise<Corpus> {
  cached ??= loadCorpus().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
