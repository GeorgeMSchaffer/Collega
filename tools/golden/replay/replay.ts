// A3 — replay the corpus against a target stack and diff.
//
// Written now, against .NET, as a self-check: a replay of a fresh capture must
// come back clean, or the harness is measuring itself rather than the stack.
// In Wave F the same command is pointed at Nest and its failure list is the
// remaining work (SPEC/50-typescript-migration.md, F1).

import { groupByScenario, normalizeExchange, type Fixture } from "../src/corpus.ts";
import { diff, formatMismatches, type Mismatch } from "../src/diff.ts";
import { Normalizer } from "../src/normalize.ts";
import type { Exchange } from "../src/runner.ts";

export type CaseResult = {
  scenario: string;
  step: string;
  endpoint: string;
  role: string;
  status: "match" | "status" | "body" | "headers" | "absent";
  mismatches: Mismatch[];
};

export type ReplayReport = {
  total: number;
  matched: number;
  results: CaseResult[];
};

type Normalized = ReturnType<typeof normalizeExchange>;

/** Compare one recorded fixture against one fresh, already-normalized response. */
export function compare(fixture: Fixture, fresh: Normalized): CaseResult {
  const expected = fixture.normalized;
  const base = {
    scenario: fixture.scenario,
    step: fixture.step,
    endpoint: fixture.endpoint,
    role: String(fixture.as),
  };

  // Status first: a 500 where a 403 was recorded is one finding, not fifty.
  if (expected.status !== fresh.status) {
    return {
      ...base,
      status: "status",
      mismatches: [
        { path: "status", expected: expected.status, actual: fresh.status, kind: "value" },
      ],
    };
  }

  const headerMismatches = diff(expected.headers, fresh.headers, "headers");
  const bodyMismatches = diff(expected.body, fresh.body, "body");
  if (bodyMismatches.length > 0) {
    return { ...base, status: "body", mismatches: [...bodyMismatches, ...headerMismatches] };
  }
  if (headerMismatches.length > 0) {
    return { ...base, status: "headers", mismatches: headerMismatches };
  }
  return { ...base, status: "match", mismatches: [] };
}

export function buildReport(fixtures: Fixture[], exchanges: Exchange[]): ReplayReport {
  // The fresh run is normalized per scenario, exactly as the capture was, so an
  // id carried from one step to the next is recognised on both sides. The
  // recorded case's `unstable` list governs, so a drifting step cannot quietly
  // widen what is ignored.
  const unstableByKey = new Map(fixtures.map((f) => [`${f.scenario}.${f.step}`, f.unstable]));
  const byKey = new Map<string, Normalized>();
  for (const [, group] of groupByScenario(exchanges)) {
    const normalizer = new Normalizer();
    for (const exchange of group) {
      const key = `${exchange.scenario}.${exchange.step}`;
      byKey.set(
        key,
        normalizeExchange({ ...exchange, unstable: unstableByKey.get(key) ?? exchange.unstable }, normalizer),
      );
    }
  }
  const results: CaseResult[] = [];

  for (const fixture of fixtures) {
    const actual = byKey.get(`${fixture.scenario}.${fixture.step}`);
    if (!actual) {
      results.push({
        scenario: fixture.scenario,
        step: fixture.step,
        endpoint: fixture.endpoint,
        role: String(fixture.as),
        status: "absent",
        mismatches: [
          {
            path: "case",
            expected: "a response",
            actual: "the step did not run — an earlier step in its scenario failed",
            kind: "missing",
          },
        ],
      });
      continue;
    }
    results.push(compare(fixture, actual));
  }

  return {
    total: results.length,
    matched: results.filter((r) => r.status === "match").length,
    results,
  };
}

export function formatReport(report: ReplayReport): string {
  const failures = report.results.filter((r) => r.status !== "match");
  const lines = [`replay: ${report.matched}/${report.total} cases match`];
  if (failures.length === 0) return lines.join("\n");

  lines.push("");
  for (const failure of failures) {
    lines.push(
      `  ${failure.scenario}.${failure.step}  ${failure.endpoint}  as ${failure.role}  [${failure.status}]`,
    );
    lines.push(formatMismatches(failure.mismatches.slice(0, 10), "      "));
    if (failure.mismatches.length > 10) {
      lines.push(`      ... and ${failure.mismatches.length - 10} more`);
    }
  }
  return lines.join("\n");
}
