"use client";

/**
 * Two things the settings screens need that `@/lib/api`'s `useApi` does not do, kept beside
 * the screens that need them rather than widened into the shared hook.
 *
 *  - **`useApiEach`** — one request per organization, in parallel. The Site Admin's
 *    cross-organization roll-ups ("All statuses", "All users") are not an endpoint: the API
 *    has no platform-wide statuses route, so the screen fans out over `GET /organizations`
 *    and asks each one. That is what the Blazor client does too, and it is why the roll-up's
 *    error copy says a single organization failing empties the whole list.
 *  - **`useSubmit`** — a mutation, on demand. Every create and every destructive action on
 *    these screens issues the *real* request, because the mock replays the real recording:
 *    an Org Admin's create comes back 201 with the record the .NET API made, and a Site
 *    Admin's comes back with the recorded 403. Refusing in the browser and never asking
 *    would be a UI claim about authorization rather than a demonstration of it, and rules
 *    25/25a/25b are exactly the thing this slice has to show working.
 */

import * as React from "react";

import { ApiError, apiFetch, useMockIdentity, type MockDiagnostics } from "@/mocks";
import type { ProblemDetails } from "@/mocks";

export type { MockDiagnostics };

function readMock(response: Response): MockDiagnostics | null {
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

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get("content-length") === "0") return null;
  const type = response.headers.get("content-type") ?? "";
  return type.includes("json") ? await response.json() : await response.text();
}

/** One entry per requested path, in the order the paths were given. */
export interface EachResult<T> {
  readonly path: string;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly mock: MockDiagnostics | null;
}

export interface EachState<T> {
  readonly state: "loading" | "ready";
  readonly results: readonly EachResult<T>[];
}

/**
 * Fetch every path in parallel and report each outcome separately.
 *
 * Separately, not merged, because the roll-up has to be able to say *which* organization it
 * could not read — and, on the mock, which organizations it is showing somebody else's
 * recording for. A single combined error would lose both.
 *
 * `paths` is joined into the effect's dependency, so a caller may hand over a fresh array
 * every render without re-fetching; only the paths themselves matter.
 */
export function useApiEach<T>(paths: readonly string[] | null): EachState<T> {
  const { generation, ready } = useMockIdentity();
  const [state, setState] = React.useState<EachState<T>>({ state: "loading", results: [] });
  const key = paths === null ? null : paths.join("\n");

  React.useEffect(() => {
    if (!ready || key === null) {
      setState({ state: "loading", results: [] });
      return;
    }
    const list = key.length === 0 ? [] : key.split("\n");
    if (list.length === 0) {
      setState({ state: "ready", results: [] });
      return;
    }

    let live = true;
    setState({ state: "loading", results: [] });

    void (async () => {
      const results = await Promise.all(
        list.map(async (path): Promise<EachResult<T>> => {
          try {
            const response = await apiFetch(path);
            const mock = readMock(response);
            const body = await readBody(response);
            if (response.ok) return { path, data: body as T, error: null, mock };
            const type = response.headers.get("content-type") ?? "";
            const problem = type.includes("json") ? (body as ProblemDetails) : null;
            return { path, data: null, error: new ApiError(response.status, problem, mock), mock };
          } catch (cause) {
            return {
              path,
              data: null,
              error: new ApiError(0, { title: "The API could not be reached.", detail: String(cause) }, null),
              mock: null,
            };
          }
        }),
      );
      if (live) setState({ state: "ready", results });
    })();

    return () => {
      live = false;
    };
  }, [key, generation, ready]);

  return state;
}

export interface SubmitState<T> {
  readonly state: "idle" | "sending" | "done" | "refused" | "failed";
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly mock: MockDiagnostics | null;
}

const IDLE: SubmitState<never> = { state: "idle", data: null, error: null, mock: null };

/**
 * A mutation the screen fires itself.
 *
 * `refused` is split out from `failed` on purpose: a 401 or a 403 that the mock matched is
 * the product working, and the screen renders the API's own sentence as an advisory. A 500,
 * or a corpus miss, is a failure and says so. `ApiError.isRefusal` already draws that line.
 */
export function useSubmit<T>(): SubmitState<T> & {
  readonly send: (method: string, path: string, body?: unknown) => Promise<void>;
  readonly reset: () => void;
} {
  const [result, setResult] = React.useState<SubmitState<T>>(IDLE as SubmitState<T>);

  const send = React.useCallback(async (method: string, path: string, body?: unknown) => {
    setResult({ state: "sending", data: null, error: null, mock: null });
    try {
      const response = await apiFetch(path, { method, body });
      const mock = readMock(response);
      const payload = await readBody(response);
      if (response.ok) {
        setResult({ state: "done", data: payload as T, error: null, mock });
        return;
      }
      const type = response.headers.get("content-type") ?? "";
      const problem = type.includes("json") ? (payload as ProblemDetails) : null;
      const error = new ApiError(response.status, problem, mock);
      setResult({ state: error.isRefusal ? "refused" : "failed", data: null, error, mock });
    } catch (cause) {
      setResult({
        state: "failed",
        data: null,
        error: new ApiError(0, { title: "The API could not be reached.", detail: String(cause) }, null),
        mock: null,
      });
    }
  }, []);

  const reset = React.useCallback(() => setResult(IDLE as SubmitState<T>), []);
  return { ...result, send, reset };
}
