"use client";

/**
 * Reading the API from a screen.
 *
 * Every request is made in the browser rather than on the server, because the identity
 * lives in a cookie the switcher writes after mount: a server component would render the
 * default role's answer and then contradict itself a frame later. `generation` from the
 * identity provider is part of the request key, so switching role discards everything the
 * previous role saw instead of leaving it on screen.
 *
 * The hook reads the mock's own `x-collega-mock-*` headers on the way past, including on a
 * 200. That is not diagnostics for its own sake: a screen has to be able to say "this is a
 * recording of a different board" or "the corpus has no page 2" out loud, and those two
 * facts arrive only in those headers. `ApiError` already carries them for failures;
 * `apiJson` drops them for successes, so this reads them itself.
 */

import * as React from "react";

import { ApiError, apiFetch, useMockIdentity, type MockDiagnostics, type ProblemDetails } from "@/mocks";

export type LoadState = "loading" | "error" | "ready";

export interface ApiResult<T> {
  readonly state: LoadState;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly mock: MockDiagnostics | null;
  readonly reload: () => void;
}

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

/** `path` is null while its inputs are still unknown — the request is simply not made. */
export function useApi<T>(path: string | null): ApiResult<T> {
  const { generation, ready } = useMockIdentity();
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<Omit<ApiResult<T>, "reload">>({
    state: "loading",
    data: null,
    error: null,
    mock: null,
  });

  React.useEffect(() => {
    // A path that has gone null means its inputs are no longer known — usually because the
    // identity changed and the organization behind it has not resolved yet. Clearing rather
    // than returning early is what keeps the previous identity's answer from staying on
    // screen under the new one, which is the whole point of re-keying on `generation`.
    if (!ready || path === null) {
      setResult({ state: "loading", data: null, error: null, mock: null });
      return;
    }
    let live = true;
    setResult({ state: "loading", data: null, error: null, mock: null });

    void (async () => {
      try {
        const response = await apiFetch(path);
        if (!live) return;
        const mock = readMock(response);
        const type = response.headers.get("content-type") ?? "";
        const body: unknown = type.includes("json") ? await response.json() : await response.text();
        if (!live) return;

        if (response.ok) {
          setResult({ state: "ready", data: body as T, error: null, mock });
        } else {
          const problem = type.includes("json") ? (body as ProblemDetails) : null;
          setResult({ state: "error", data: null, error: new ApiError(response.status, problem, mock), mock });
        }
      } catch (cause) {
        if (!live) return;
        // The request never reached the server — offline, DNS, a dropped connection. There
        // is no problem+json to show, so it is reported as a transport failure.
        setResult({
          state: "error",
          data: null,
          error: new ApiError(0, { title: "The API could not be reached.", detail: String(cause) }, null),
          mock: null,
        });
      }
    })();

    return () => {
      live = false;
    };
  }, [path, generation, ready, attempt]);

  const reload = React.useCallback(() => setAttempt((value) => value + 1), []);
  return { ...result, reload };
}

/** True when the mock answered a query it had no recording of — a hole, not a result. */
export function queryWasIgnored(mock: MockDiagnostics | null): boolean {
  return mock?.notes.includes("query-ignored") ?? false;
}

/** True when the answer is a recording of a *different* record at the same endpoint. */
export function pathWasSubstituted(mock: MockDiagnostics | null): boolean {
  return mock?.match === "substituted";
}
