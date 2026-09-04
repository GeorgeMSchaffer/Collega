/**
 * Turning a resolution into an HTTP response, and answering a request end to end.
 *
 * A match is served as it was recorded — the recorded status, the recorded body, the
 * recorded content type, including `application/problem+json` on the 403s and `text/csv` on
 * the export. Volatile transport headers are dropped: `date` and `server` describe Kestrel
 * on the afternoon of the capture, and `transfer-encoding` describes a framing this server
 * is not using.
 *
 * A miss is served as 501. The real API returns 501 nowhere, so the status itself says the
 * mock could not answer rather than that the product refused — and the body says which of
 * the two it was, in words, at the place a developer is already looking.
 */

import { USE_MOCK_API } from "./config";
import { CASE_KINDS, type CaseKind, type Corpus, canonicalQuery, getCorpus } from "./corpus";
import {
  DEFAULT_MOCK_IDENTITY,
  MOCK_IDENTITY_COOKIE,
  MOCK_IDENTITY_HEADER,
  type MockIdentity,
  isMockIdentity,
} from "./identity";
import { recordEvent } from "./report";
import { type Resolution, resolve } from "./router";

/** Query parameters the mock consumes itself and never forwards into matching. */
const MOCK_KIND_PARAM = "__mockKind";
const MOCK_KIND_HEADER = "x-collega-mock-kind";

/** Per-hop or per-capture headers that describe the recording's transport, not its content. */
const DROPPED_HEADERS = new Set([
  "date",
  "server",
  "transfer-encoding",
  "content-length",
  "connection",
  "keep-alive",
]);

const MOCK_PROBLEM_TYPE = "https://collega.dev/problems/mock-no-recording";

function identityOf(request: Request): MockIdentity {
  const header = request.headers.get(MOCK_IDENTITY_HEADER);
  if (isMockIdentity(header)) return header;

  const cookie = request.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === MOCK_IDENTITY_COOKIE) {
        const value = decodeURIComponent(rest.join("="));
        if (isMockIdentity(value)) return value;
      }
    }
  }
  return DEFAULT_MOCK_IDENTITY;
}

/**
 * The explicit case-kind pick. A value that is not one of the four kinds is a typo, and a
 * typo that silently served the happy path would be the worst possible answer — the caller
 * asked for a refusal and got a success with nothing to say it had been ignored.
 */
function wantedKindOf(
  request: Request,
  params: URLSearchParams,
): { kind: CaseKind | undefined } | { invalid: string } {
  const raw = params.get(MOCK_KIND_PARAM) ?? request.headers.get(MOCK_KIND_HEADER);
  if (raw === null) return { kind: undefined };
  if ((CASE_KINDS as readonly string[]).includes(raw)) return { kind: raw as CaseKind };
  return { invalid: raw };
}

function bodyless(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}

function toResponse(resolution: Resolution, identity: MockIdentity): Response {
  const headers = new Headers({
    "x-collega-mock": "golden-corpus",
    "x-collega-mock-identity": identity,
  });

  if (resolution.outcome === "miss") {
    headers.set("cache-control", "no-store");
    headers.set("x-collega-mock-match", "miss");
    headers.set("x-collega-mock-miss", resolution.reason);
    headers.set("content-type", "application/problem+json; charset=utf-8");
    return new Response(
      JSON.stringify(
        {
          type: MOCK_PROBLEM_TYPE,
          title: "The mock has no recording for this request",
          status: 501,
          detail: resolution.detail,
          reason: resolution.reason,
          endpoint: resolution.endpointId,
          recordedIdentities: resolution.recordedIdentities,
          recordedKinds: resolution.recordedKinds,
        },
        null,
        2,
      ),
      { status: 501, headers },
    );
  }

  const { fixture, notes, quality } = resolution;
  for (const [name, value] of Object.entries(fixture.response.headers)) {
    if (!DROPPED_HEADERS.has(name.toLowerCase())) headers.set(name, value);
  }
  // After the recorded headers, not before: the mock is a recording of one afternoon, not a
  // live system, and anything cached would outlive a role switch and answer the next identity
  // with the last one's data. A recorded cache-control must not be able to reintroduce that.
  headers.set("cache-control", "no-store");
  headers.set("x-collega-mock-match", quality);
  headers.set("x-collega-mock-fixture", fixture.file);
  headers.set("x-collega-mock-endpoint", fixture.endpoint);
  headers.set("x-collega-mock-kind", fixture.kind);
  if (notes.length > 0) {
    headers.set("x-collega-mock-notes", notes.map((note) => note.note).join(","));
    for (const note of notes) {
      if (note.note === "substituted-path") headers.set("x-collega-mock-recorded-path", note.recordedPath);
      if (note.note === "query-ignored") headers.set("x-collega-mock-recorded-query", note.recordedQuery || "(none)");
      if (note.note === "several-recordings") headers.set("x-collega-mock-recordings", String(note.count));
    }
  }

  if (bodyless(fixture.response.status)) {
    return new Response(null, { status: fixture.response.status, headers });
  }

  const body = fixture.response.body;
  if (typeof body === "string") {
    if (!headers.has("content-type")) headers.set("content-type", "text/plain; charset=utf-8");
    return new Response(body, { status: fixture.response.status, headers });
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status: fixture.response.status, headers });
}

function disabled(): Response {
  return new Response(
    JSON.stringify(
      {
        type: MOCK_PROBLEM_TYPE,
        title: "The mock is switched off",
        status: 503,
        detail:
          "NEXT_PUBLIC_USE_MOCK_API=0, so the app is meant to be talking to the real API. Something is " +
          "still calling this app's /api/v1 route — check NEXT_PUBLIC_API_BASE_URL in apps/web/mocks/config.ts.",
      },
      null,
      2,
    ),
    {
      status: 503,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        "x-collega-mock-match": "disabled",
        "cache-control": "no-store",
      },
    },
  );
}

/** The corpus could not be loaded, so there is nothing to serve — said in words, not as a 500. */
function unavailable(error: unknown): Response {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[mock] The corpus could not be loaded: ${detail}`);
  return new Response(
    JSON.stringify({ type: MOCK_PROBLEM_TYPE, title: "The mock has no corpus", status: 503, detail }, null, 2),
    {
      status: 503,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        "x-collega-mock-match": "unavailable",
        "cache-control": "no-store",
      },
    },
  );
}

/**
 * The whole mock, as one function: read the identity off the request, find the recording,
 * serve it, and log what that cost in fidelity.
 *
 * `basePathPrefix` is the route's own mount point. Corpus paths are recorded relative to the
 * API base path, so the prefix comes off before matching and the two are the same strings.
 */
export async function serveFromCorpus(request: Request, basePathPrefix: string): Promise<Response> {
  if (!USE_MOCK_API) return disabled();

  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  const wanted = wantedKindOf(request, params);
  params.delete(MOCK_KIND_PARAM);

  const identity = identityOf(request);
  const path = url.pathname.startsWith(basePathPrefix)
    ? url.pathname.slice(basePathPrefix.length) || "/"
    : url.pathname;
  const query = canonicalQuery(params.toString());

  // Next routes HEAD to the GET handler but leaves the method as HEAD, and the corpus records
  // no HEAD case for anything — it is GET's companion, not a case of its own. So it resolves
  // as the GET it is, and the body is dropped at the end, as HEAD requires.
  const head = request.method === "HEAD";
  const method = head ? "GET" : request.method;

  let corpus: Corpus;
  try {
    corpus = await getCorpus();
  } catch (error: unknown) {
    // The corpus is the whole mock. Failing to load it is the most likely first-run problem
    // there is, so it answers in words rather than as a bare 500 with an empty body.
    return unavailable(error);
  }

  const resolution: Resolution =
    "invalid" in wanted
      ? {
          outcome: "miss",
          reason: "unknown-case-kind",
          detail:
            `"${wanted.invalid}" is not a case kind. The corpus records ${CASE_KINDS.join(", ")}; serving the ` +
            "default case instead would answer a request for a refusal with a success.",
          recordedKinds: CASE_KINDS,
        }
      : resolve(corpus, { method, path, query, identity, wantedKind: wanted.kind });
  const served = toResponse(resolution, identity);
  const response = head ? new Response(null, { status: served.status, headers: served.headers }) : served;

  recordEvent({
    at: new Date().toISOString(),
    method: request.method,
    path,
    query,
    identity,
    status: response.status,
    outcome: resolution.outcome,
    quality: resolution.outcome === "match" ? resolution.quality : undefined,
    reason: resolution.outcome === "miss" ? resolution.reason : undefined,
    endpointId: resolution.endpointId,
    fixture: resolution.outcome === "match" ? resolution.fixture.file : undefined,
    notes: resolution.outcome === "match" ? resolution.notes : [],
    detail: resolution.outcome === "miss" ? resolution.detail : undefined,
  });

  // Substitutions and misses are the two things a reader must not take for a recording, so
  // they are said out loud in the server log as well as in the response.
  if (resolution.outcome === "miss") {
    console.warn(`[mock] ${method} ${path} as ${identity} — ${resolution.reason}: ${resolution.detail}`);
  } else if (resolution.quality === "substituted") {
    console.warn(
      `[mock] ${method} ${path} as ${identity} — substituted the recording for ` +
        `${resolution.fixture.request.path} (${resolution.fixture.file}).`,
    );
  }

  return response;
}
