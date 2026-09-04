"use client";

/**
 * Writing to the API from the inspector, and returning focus when it closes.
 *
 * `lib/api.ts` covers reads. A write is a different shape: it happens on a click rather than
 * on render, it has to be prevented from running twice, and — the part that matters here —
 * the caller needs to know not just that it succeeded but *what the mock did to succeed*. A
 * recorded `POST /ideas/{id}/upvote/toggle` answers `{hasUpvoted: true, upvoteCount: 2}` no
 * matter which idea is asked about, because the corpus recorded it against one idea. Adopting
 * those numbers for a different idea would put another idea's vote count on screen. So the
 * result carries the mock diagnostics and the caller decides.
 */

import * as React from "react";

import { ApiError, apiFetch, type MockDiagnostics, type ProblemDetails } from "@/mocks";

export type WriteState = "idle" | "running" | "done" | "failed";

export interface WriteOutcome<T> {
  readonly data: T | null;
  readonly mock: MockDiagnostics | null;
  /** True when the recording was made against this exact path — see `mocks/router.ts`. */
  readonly exact: boolean;
}

export interface Write<T> {
  readonly state: WriteState;
  readonly error: ApiError | null;
  readonly outcome: WriteOutcome<T> | null;
  readonly run: (init?: { method?: string; body?: unknown; path?: string }) => Promise<WriteOutcome<T> | null>;
  readonly reset: () => void;
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

/**
 * One write, with its own state. `path` and `method` are the defaults; `run` may override the
 * path so a single hook can serve a list of rows.
 */
export function useWrite<T = null>(path: string, method = "POST"): Write<T> {
  const [state, setState] = React.useState<WriteState>("idle");
  const [error, setError] = React.useState<ApiError | null>(null);
  const [outcome, setOutcome] = React.useState<WriteOutcome<T> | null>(null);

  // A component that unmounts mid-flight — the column closed, the role switched — must not
  // set state afterwards, and a ref is the only thing that survives the closure.
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const run = React.useCallback<Write<T>["run"]>(
    async (init) => {
      setState("running");
      setError(null);
      try {
        const response = await apiFetch(init?.path ?? path, {
          method: init?.method ?? method,
          body: init?.body,
        });
        const mock = readMock(response);
        const type = response.headers.get("content-type") ?? "";
        const hasBody = response.status !== 204 && response.headers.get("content-length") !== "0";
        const body: unknown = !hasBody ? null : type.includes("json") ? await response.json() : await response.text();

        if (!response.ok) {
          const problem = type.includes("json") ? (body as ProblemDetails) : null;
          if (live.current) {
            setError(new ApiError(response.status, problem, mock));
            setState("failed");
          }
          return null;
        }

        const result: WriteOutcome<T> = { data: body as T, mock, exact: mock?.match !== "substituted" };
        if (live.current) {
          setOutcome(result);
          setState("done");
        }
        return result;
      } catch (cause) {
        if (live.current) {
          setError(new ApiError(0, { title: "The API could not be reached.", detail: String(cause) }, null));
          setState("failed");
        }
        return null;
      }
    },
    [path, method],
  );

  const reset = React.useCallback(() => {
    setState("idle");
    setError(null);
    setOutcome(null);
  }, []);

  return { state, error, outcome, run, reset };
}

/**
 * Give focus back to whatever opened this surface.
 *
 * Sprint 7.5's finding was not that Escape did nothing — it was that closing left focus on
 * `<body>`, so the next Tab restarted at the top of the page and a keyboard user lost their
 * place in a twenty-two row list. The column is not a modal and takes no focus on open, so
 * there is nothing to restore *to* except the control that was focused when it opened; that
 * element is remembered here and re-focused on close, whichever way the close happened —
 * Escape, the X, or Cancel.
 *
 * `isConnected` guards the case where the invoking control has itself gone away, which is
 * what happens when a create succeeds and the row that replaces the button is a new node.
 */
export function useReturnFocus(): void {
  React.useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
}
