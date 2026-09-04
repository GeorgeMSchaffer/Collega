/**
 * What the mock has actually been doing.
 *
 * Every resolution lands here — the exact recordings, the substitutions, and the refusals —
 * so a screen can show "this page is 4 recordings and 1 substitution" instead of the reader
 * having to trust that everything on it was real. `GET /api/mock/report` serves it.
 *
 * Process-local and in memory: it is a development aid, it resets when the server restarts,
 * and it is not shared across instances. Bounded, so a long session cannot grow without end.
 */

import type { MockIdentity } from "./identity";
import type { MatchQuality, MissReason, MockNote } from "./router";

export interface MockEvent {
  readonly at: string;
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly identity: MockIdentity;
  readonly status: number;
  readonly outcome: "match" | "miss";
  readonly quality?: MatchQuality;
  readonly reason?: MissReason;
  readonly endpointId?: string;
  readonly fixture?: string;
  readonly notes: readonly MockNote[];
  readonly detail?: string;
}

const LIMIT = 250;
const events: MockEvent[] = [];

export interface MockCounts {
  readonly total: number;
  readonly exact: number;
  readonly substituted: number;
  readonly missed: number;
  readonly queriesIgnored: number;
}

/**
 * Counted as they happen rather than from the buffer. The buffer forgets, and a substitution
 * that scrolled off it is exactly the one somebody needs to know about — a report that said
 * "0 substitutions" because the evidence had aged out would be worse than no report.
 */
const counts = { total: 0, exact: 0, substituted: 0, missed: 0, queriesIgnored: 0 };

export function recordEvent(event: MockEvent): void {
  counts.total += 1;
  if (event.quality === "exact") counts.exact += 1;
  if (event.quality === "substituted") counts.substituted += 1;
  if (event.outcome === "miss") counts.missed += 1;
  if (event.notes.some((note) => note.note === "query-ignored")) counts.queriesIgnored += 1;

  events.push(event);
  if (events.length > LIMIT) events.splice(0, events.length - LIMIT);
}

export interface MockReport {
  /** How many events the list below holds at most; `counts` covers the whole run. */
  readonly limit: number;
  readonly counts: MockCounts;
  readonly retained: number;
  readonly events: readonly MockEvent[];
}

export function readReport(): MockReport {
  return {
    limit: LIMIT,
    counts: { ...counts },
    retained: events.length,
    // Newest first: the interesting event is the one that just happened.
    events: [...events].reverse(),
  };
}
