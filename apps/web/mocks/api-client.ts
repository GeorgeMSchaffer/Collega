/**
 * The one way the app talks to the API.
 *
 * It lives beside the mock because the mock is what it currently reaches, but nothing in it
 * is mock-specific except the identity header — every call goes to `API_BASE_URL`, and after
 * cutover that is Nest. See `apps/web/mocks/config.ts` for the swap.
 *
 * Two things it does that a bare `fetch` does not:
 *
 *  - **Carries the identity.** Same-origin requests already send the cookie the switcher
 *    writes; the header is set as well, so the identity survives a base URL on another
 *    origin and is visible in devtools without opening the cookie jar.
 *  - **Makes a refusal a value, not a surprise.** The corpus is 228 refusals to 206
 *    successes, and being able to walk the app as a role and see it refuse is most of what
 *    this mock is for. A non-2xx comes back as an `ApiError` carrying the recorded
 *    problem+json, so a screen can render the API's own words instead of "something failed".
 */

import { API_BASE_URL, SERVER_ORIGIN } from "./config";
import { MOCK_IDENTITY_COOKIE, MOCK_IDENTITY_HEADER, type MockIdentity, isMockIdentity } from "./identity";

/** RFC 9457 problem details, which is what this API answers every error with. */
export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
}

/** What the mock said about how it answered — absent once the real API is behind this. */
export interface MockDiagnostics {
  readonly match: "exact" | "substituted" | "miss" | "disabled";
  readonly fixture: string | null;
  readonly endpoint: string | null;
  readonly kind: string | null;
  readonly notes: readonly string[];
  readonly recordedPath: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;
  readonly mock: MockDiagnostics | null;

  constructor(status: number, problem: ProblemDetails | null, mock: MockDiagnostics | null) {
    super(problem?.detail ?? problem?.title ?? `The API answered ${status}.`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.mock = mock;
  }

  /** True when the mock had no recording — a hole in the corpus, not product behaviour. */
  get isMockGap(): boolean {
    return this.mock?.match === "miss" || this.mock?.match === "disabled";
  }

  /** True when the API refused: the case worth showing a role, and a real recording. */
  get isRefusal(): boolean {
    return !this.isMockGap && (this.status === 401 || this.status === 403);
  }
}

export interface ApiRequestInit extends Omit<RequestInit, "body"> {
  /** Serialized as JSON unless it is already a string, FormData or Blob. */
  readonly body?: unknown;
  /** Overrides the browser's stored identity — needed on the server, where there is none. */
  readonly identity?: MockIdentity;
}

function identityFromCookie(): MockIdentity | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === MOCK_IDENTITY_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      if (isMockIdentity(value)) return value;
    }
  }
  return null;
}

function readMockDiagnostics(response: Response): MockDiagnostics | null {
  const match = response.headers.get("x-collega-mock-match");
  if (match === null) return null;
  const notes = response.headers.get("x-collega-mock-notes");
  return {
    match: match === "exact" || match === "substituted" || match === "disabled" ? match : "miss",
    fixture: response.headers.get("x-collega-mock-fixture"),
    endpoint: response.headers.get("x-collega-mock-endpoint"),
    kind: response.headers.get("x-collega-mock-kind"),
    notes: notes ? notes.split(",") : [],
    recordedPath: response.headers.get("x-collega-mock-recorded-path"),
  };
}

function isJson(response: Response): boolean {
  const type = response.headers.get("content-type") ?? "";
  return type.includes("json");
}

/**
 * The absolute URL to call.
 *
 * In a browser a relative base is fine — it resolves against the document. On the server there
 * is no document, and Node's `fetch` rejects a relative URL outright, so the configured origin
 * is put in front. A base that is already absolute is left exactly as it is.
 */
function urlFor(path: string): string {
  const base = API_BASE_URL;
  if (typeof window !== "undefined" || /^https?:\/\//i.test(base)) return `${base}${path}`;
  return `${SERVER_ORIGIN}${base}${path}`;
}

/**
 * `path` is relative to the API base path, in exactly the form the corpus records it:
 * `/boards/182df148-…/ideas`, not `/api/v1/boards/…`.
 *
 * On the server there is no cookie jar, so a server component has to say who it is calling as
 * — pass `identity`, or every call arrives as the default.
 */
export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const { body, identity, headers, ...rest } = init;
  const merged = new Headers(headers);

  const who = identity ?? identityFromCookie();
  if (who) merged.set(MOCK_IDENTITY_HEADER, who);

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (typeof body === "string" || body instanceof FormData || body instanceof Blob) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      if (!merged.has("content-type")) merged.set("content-type", "application/json");
    }
  }

  return fetch(urlFor(path), { ...rest, headers: merged, body: payload });
}

/**
 * The same call, decoded. 204 comes back as `null`; anything non-2xx throws an `ApiError`
 * carrying the recorded problem details.
 */
export async function apiJson<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const mock = readMockDiagnostics(response);

  if (!response.ok) {
    const problem: ProblemDetails | null = isJson(response) ? ((await response.json()) as ProblemDetails) : null;
    throw new ApiError(response.status, problem, mock);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T;
  }
  return (isJson(response) ? await response.json() : await response.text()) as T;
}
