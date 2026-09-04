"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Skeleton,
} from "@collega/design-system";

import type { ApiError } from "@/mocks";

/**
 * The three things a screen has to be able to say when a request does not come back with
 * data, kept apart because they mean different things to whoever is looking.
 *
 *  - **Refusal.** The API said no, in its own words, and that is the product working. Shown
 *    as an advisory, not as a failure: nothing is broken and retrying will not help.
 *  - **Failure.** Something went wrong. Shown with a retry, because retrying is safe.
 *  - **Corpus note.** The mock could not answer honestly — no recording for this page, this
 *    filter, or this board — and served something adjacent, or nothing. This is scaffolding
 *    and says so; it disappears with the mock.
 */

export function RefusalNotice({
  error,
  what,
  className,
}: {
  error: ApiError;
  /** What the viewer was trying to see — the API's own words say why, not what. */
  what?: string;
  className?: string;
}) {
  return (
    <Alert variant="warning" className={className}>
      <AlertTitle>
        {what ? `${what} — ` : ""}
        {error.problem?.title ?? "You do not have access to this"}
      </AlertTitle>
      <AlertDescription>
        {error.problem?.detail ?? "The API refused this request for your role."}
      </AlertDescription>
    </Alert>
  );
}

export function ErrorNotice({
  error,
  what,
  onRetry,
  className,
}: {
  error?: ApiError | null;
  what: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Alert variant="destructive">
        <AlertTitle>Couldn&rsquo;t load {what}.</AlertTitle>
        <AlertDescription>
          Nothing has been changed. Retrying is safe.
          {error?.problem?.detail ? ` The API said: ${error.problem.detail}` : ""}
        </AlertDescription>
      </Alert>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/**
 * `role="status"` rather than `role="alert"`: a gap in the recordings is information for
 * whoever is driving the app, not an error condition to interrupt them with.
 */
export function CorpusNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="status"
      data-slot="corpus-note"
      className={`rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}
    >
      <span className="font-medium text-foreground">Recorded data</span> — {children}
    </div>
  );
}

/** Skeletons that hold the height of the rows they stand in for, never a spinner. */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  const widths = ["78%", "62%", "84%", "55%", "70%", "66%", "80%", "58%"];
  return (
    <div className="rounded-xl border bg-card p-4">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="mt-4 h-3 first:mt-0" style={{ width: widths[index % widths.length] }} />
      ))}
    </div>
  );
}
