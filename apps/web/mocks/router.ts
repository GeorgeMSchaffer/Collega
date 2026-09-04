/**
 * Routing a live request onto a recorded one.
 *
 * The corpus stores raw values, not placeholders: real GUIDs, real titles, and paths that
 * are concrete rather than templated. So there are two ways to find a recording, and they
 * are not equally honest:
 *
 *  1. **Exact.** Same method, same concrete path, same identity. This is a recording, full
 *     stop — the bytes the .NET API answered with. It is what the app gets whenever it
 *     navigates along ids it read out of an earlier recorded response, which is the normal
 *     case: the board list carries the board ids, the board's ideas carry the idea ids.
 *
 *  2. **Substituted.** The concrete path matches an endpoint template from the manifest
 *     (`GET /boards/{boardId}/ideas`), a recording exists for that endpoint at this
 *     identity, but it was recorded against *different* ids. Serving it answers a question
 *     about board X with the recording for board Y. That is the one place this mock shows
 *     something the capture did not record, so it never happens quietly: the response
 *     carries `x-collega-mock-match: substituted` and the path it really came from, the resolution
 *     is written to the report at `/api/mock/report`, and `COLLEGA_MOCK_STRICT=1` turns
 *     it into a refusal instead.
 *
 * Anything else is a miss, and a miss is a refusal that says why. The mock never invents a
 * body, never returns an empty list for an endpoint it has no recording of, and never
 * answers as one identity when asked as another — a fabricated 200 where the real API would
 * have refused is exactly the defect this corpus exists to catch.
 */

import { MOCK_STRICT } from "./config";
import {
  type CaseKind,
  type Corpus,
  type EndpointTemplate,
  type Fixture,
  concreteKey,
  endpointKey,
} from "./corpus";
import type { MockIdentity } from "./identity";

export type MatchQuality = "exact" | "substituted";

/** Something the served response is not a literal recording of. */
export type MockNote =
  | { readonly note: "substituted-path"; readonly recordedPath: string }
  | { readonly note: "query-ignored"; readonly query: string; readonly recordedQuery: string }
  | { readonly note: "several-recordings"; readonly count: number; readonly chosen: string };

export type MissReason =
  | "unknown-endpoint"
  | "identity-not-recorded"
  | "case-kind-not-recorded"
  | "unknown-case-kind"
  | "strict-substitution"
  | "strict-query";

export interface MockMatch {
  readonly outcome: "match";
  readonly quality: MatchQuality;
  readonly endpointId: string;
  readonly fixture: Fixture;
  readonly notes: readonly MockNote[];
}

export interface MockMiss {
  readonly outcome: "miss";
  readonly reason: MissReason;
  /** One sentence, addressed to whoever is looking at the failing screen. */
  readonly detail: string;
  readonly endpointId?: string;
  readonly recordedIdentities?: readonly MockIdentity[];
  readonly recordedKinds?: readonly CaseKind[];
}

export type Resolution = MockMatch | MockMiss;

export interface MockRequest {
  readonly method: string;
  /** Path relative to the corpus base path, e.g. `/boards/{id}/ideas`. No query. */
  readonly path: string;
  /** Raw query string, without the `?`, after mock-only parameters are removed. */
  readonly query: string;
  readonly identity: MockIdentity;
  /** Explicit case-kind pick, for driving an error state on purpose. */
  readonly wantedKind?: CaseKind;
}

/** `{param}` matches exactly one non-empty segment; everything else matches itself. */
function templateMatches(template: EndpointTemplate, segments: readonly string[]): boolean {
  if (template.segments.length !== segments.length) return false;
  return template.segments.every((expected, index) => {
    const actual = segments[index];
    if (actual === undefined || actual.length === 0) return false;
    return expected.startsWith("{") ? true : expected === actual;
  });
}

/**
 * The endpoint a concrete path belongs to.
 *
 * More literal segments wins, so `POST /organizations/{id}/archive` is preferred over a
 * hypothetical `POST /organizations/{id}/{name}` rather than being decided by manifest
 * order. A genuine tie would mean the manifest holds two indistinguishable routes, which is
 * a corpus problem and not something to guess about, so it resolves to nothing.
 */
export function matchEndpoint(corpus: Corpus, method: string, requestPath: string): EndpointTemplate | null {
  const segments = requestPath.split("/").filter((segment) => segment.length > 0);
  const upper = method.toUpperCase();
  const candidates = corpus.endpoints.filter(
    (endpoint) => endpoint.method === upper && templateMatches(endpoint, segments),
  );
  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  let tied = false;
  for (const candidate of candidates.slice(1)) {
    if (candidate.literals > best.literals) {
      best = candidate;
      tied = false;
    } else if (candidate.literals === best.literals) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Case-kind preference when one endpoint and identity were recorded more than once.
 *
 * 385 of the corpus's 394 endpoint-and-identity pairs hold a single kind, so this rarely
 * decides anything — and where the single kind is `denied`, that refusal is what gets
 * served, which is the point. The nine pairs that mix kinds are all POSTs where the
 * difference is the request body rather than the caller: a bad password, a blank title. The
 * app is submitting a filled-in form, so `success` leads; the other kinds stay reachable by
 * asking for them (`?__mockKind=invalid`).
 */
const KIND_PREFERENCE: readonly CaseKind[] = ["success", "denied", "invalid", "missing"];

function chooseFixture(candidates: readonly Fixture[], wanted: CaseKind | undefined): Fixture | null {
  const pool = wanted ? candidates.filter((fixture) => fixture.kind === wanted) : candidates;
  if (pool.length === 0) return null;

  const kind = wanted ?? KIND_PREFERENCE.find((k) => pool.some((fixture) => fixture.kind === k));
  const ofKind = pool.filter((fixture) => fixture.kind === kind);

  // The same request, recorded at several points in a mutating scenario — a status list
  // before and after a create, say. Twelve groups in the corpus look like this once the query
  // has been matched, and every one of them is the identical request answered at a different
  // moment. The fullest is taken: each is a real recording, and the richer body is the one a
  // screen has something to show from. Ties break on file name so the choice is stable.
  return ofKind.reduce((best, fixture) => {
    if (fixture.weight > best.weight) return fixture;
    if (fixture.weight === best.weight && fixture.file < best.file) return fixture;
    return best;
  }, ofKind[0]!);
}

/**
 * Narrow a pool to the recordings that were made with the query the caller is asking for.
 *
 * Ten of the 447 cases were recorded with one — `?search=safe` on the tag suggestions, and
 * the like — and they sit at the same path as the unfiltered case. Matching the query is what
 * keeps the tag picker's plain list from being answered with the search result.
 *
 * `honoured: false` means the pool that came back was recorded under a different query than
 * the one asked for, in either direction: an unrecorded filter, or an unfiltered request that
 * only a filtered recording exists for. Either way the caller is told.
 */
function narrowToQuery(pool: readonly Fixture[], query: string): { pool: readonly Fixture[]; honoured: boolean } {
  const same = pool.filter((fixture) => fixture.request.query === query);
  if (same.length > 0) return { pool: same, honoured: true };

  const unfiltered = pool.filter((fixture) => fixture.request.query === "");
  if (unfiltered.length > 0) return { pool: unfiltered, honoured: false };

  return { pool, honoured: false };
}

export function resolve(corpus: Corpus, request: MockRequest): Resolution {
  const notes: MockNote[] = [];

  const endpoint = matchEndpoint(corpus, request.method, request.path);
  if (!endpoint) {
    return {
      outcome: "miss",
      reason: "unknown-endpoint",
      detail:
        `${request.method} ${request.path} matches none of the ${corpus.endpoints.length} endpoints the ` +
        "corpus recorded. Either the path is wrong, or this is a route the .NET API never had — the mock " +
        "has nothing recorded for it and will not invent one.",
    };
  }

  const exact = corpus.byConcrete.get(concreteKey(request.method, request.path, request.identity)) ?? [];
  const forEndpoint = corpus.byEndpoint.get(endpointKey(endpoint.id, request.identity)) ?? [];

  if (forEndpoint.length === 0) {
    const recorded = corpus.identitiesByEndpoint.get(endpoint.id) ?? [];
    return {
      outcome: "miss",
      reason: "identity-not-recorded",
      endpointId: endpoint.id,
      recordedIdentities: recorded,
      detail:
        `"${endpoint.id}" was never recorded as ${request.identity}. It exists at ` +
        `${recorded.length > 0 ? recorded.join(", ") : "no identity at all"}. Serving one of those instead ` +
        "would answer as somebody else, which is the one thing a role-aware mock must not do.",
    };
  }

  const quality: MatchQuality = exact.length > 0 ? "exact" : "substituted";
  const { pool, honoured } = narrowToQuery(exact.length > 0 ? exact : forEndpoint, request.query);

  if (!honoured) {
    const recordedQuery = pool[0]?.request.query ?? "";
    if (MOCK_STRICT) {
      return {
        outcome: "miss",
        reason: "strict-query",
        endpointId: endpoint.id,
        detail:
          `"${endpoint.id}" was not recorded with the query "${request.query || "(none)"}" — the nearest ` +
          `recording carries "${recordedQuery || "(none)"}". The corpus never varied paging or filtering ` +
          "beyond what it captured, and strict mode refuses rather than answering one query with another's " +
          "results.",
      };
    }
    notes.push({ note: "query-ignored", query: request.query, recordedQuery });
  }

  const fixture = chooseFixture(pool, request.wantedKind);
  if (!fixture) {
    const kinds = [...new Set(pool.map((candidate) => candidate.kind))];
    return {
      outcome: "miss",
      reason: "case-kind-not-recorded",
      endpointId: endpoint.id,
      recordedKinds: kinds,
      detail:
        `"${endpoint.id}" as ${request.identity} has no "${request.wantedKind}" case. ` +
        `Recorded kinds: ${kinds.join(", ")}.`,
    };
  }

  if (quality === "substituted") {
    if (MOCK_STRICT) {
      return {
        outcome: "miss",
        reason: "strict-substitution",
        endpointId: endpoint.id,
        detail:
          `${request.method} ${request.path} was not recorded. The corpus holds "${endpoint.id}" at this ` +
          `identity, but against ${fixture.request.path}. Strict mode refuses rather than answering about ` +
          "one record with another's data.",
      };
    }
    notes.push({ note: "substituted-path", recordedPath: fixture.request.path });
  }

  const sameKind = pool.filter((candidate) => candidate.kind === fixture.kind);
  if (sameKind.length > 1) {
    notes.push({ note: "several-recordings", count: sameKind.length, chosen: fixture.file });
  }

  return { outcome: "match", quality, endpointId: endpoint.id, fixture, notes };
}
