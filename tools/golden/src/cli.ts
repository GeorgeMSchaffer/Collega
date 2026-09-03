#!/usr/bin/env node
// The one entry point: inventory | scaffold | capture | replay | coverage.
//
//   node tools/golden/src/cli.ts inventory
//   node tools/golden/src/cli.ts scaffold
//   GOLDEN_PASSWORD=... node tools/golden/src/cli.ts capture --base-url http://localhost:5000
//   GOLDEN_PASSWORD=... node tools/golden/src/cli.ts replay  --base-url http://localhost:3000
//   node tools/golden/src/cli.ts coverage

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import { readInventory, ROLES, type Endpoint } from "./inventory.ts";
import { loadScenarios } from "./scenarios.ts";
import { Runner, type Exchange, type StepFailure } from "./runner.ts";
import { readCorpus, writeCorpus } from "./corpus.ts";
import { DEFAULT_BASE_PATH, DEFAULT_BASE_URL, readCredentials } from "./config.ts";
import { formatReport as formatCoverage, report as coverageReport } from "./coverage.ts";
import { buildReport, formatReport as formatReplay } from "../replay/replay.ts";
import { scaffoldScenarios } from "./scaffold.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPO = path.resolve(ROOT, "..", "..");

const PATHS = {
  controllers: path.join(REPO, "src", "Collega.API", "Controllers"),
  scenarios: path.join(ROOT, "scenarios"),
  fixtures: path.join(ROOT, "fixtures"),
};

type Args = { command: string; flags: Map<string, string> };

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const [name, inline] = token.slice(2).split("=");
    flags.set(name, inline ?? (rest[i + 1]?.startsWith("--") ? "true" : rest[++i] ?? "true"));
  }
  return { command, flags };
}

async function endpointMap(): Promise<{ list: Endpoint[]; byId: Map<string, Endpoint> }> {
  const list = await readInventory(PATHS.controllers);
  return { list, byId: new Map(list.map((e) => [e.id, e])) };
}

type RunSummary = {
  failures: StepFailure[];
  skipped: { scenario: string; step: string }[];
  surprises: { scenario: string; step: string; expected: number; actual: number }[];
};

async function run(args: Args, exchanges: Exchange[] = []): Promise<RunSummary> {
  const { byId } = await endpointMap();
  const scenarios = await loadScenarios(PATHS.scenarios);
  const runner = new Runner({
    baseUrl: args.flags.get("base-url") ?? DEFAULT_BASE_URL,
    basePath: args.flags.get("base-path") ?? DEFAULT_BASE_PATH,
    credentials: readCredentials(),
    stopOnError: args.flags.get("keep-going") !== "true",
  });

  const summary: RunSummary = { failures: [], skipped: [], surprises: [] };
  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.name.padEnd(24)} `);
    const result = await runner.runScenario(scenario, byId);
    exchanges.push(...result.exchanges);
    summary.failures.push(...result.failures);
    summary.skipped.push(...result.skipped);
    summary.surprises.push(...result.surprises);
    runner.resetSessions();
    process.stdout.write(
      `${String(result.exchanges.length).padStart(3)} run, ${result.failures.length} failed, ` +
        `${result.skipped.length} todo\n`,
    );
  }
  return summary;
}

function reportRun(summary: RunSummary): void {
  if (summary.failures.length > 0) {
    console.error(`\n${summary.failures.length} step(s) did not run:`);
    for (const f of summary.failures) console.error(`  ${f.scenario}.${f.step}: ${f.reason}`);
  }
  if (summary.surprises.length > 0) {
    console.error(`\n${summary.surprises.length} step(s) returned a status the scenario did not expect:`);
    for (const s of summary.surprises) {
      console.error(`  ${s.scenario}.${s.step}: expected ${s.expected}, got ${s.actual}`);
    }
  }
  if (summary.skipped.length > 0) {
    console.error(`\n${summary.skipped.length} step(s) still marked todo — the corpus is incomplete.`);
  }
}

const commands: Record<string, (args: Args) => Promise<number>> = {
  async inventory(args) {
    const { list } = await endpointMap();
    if (args.flags.get("json") === "true") {
      console.log(JSON.stringify(list, null, 2));
      return 0;
    }
    for (const e of list) {
      const auth = e.authorize === "anonymous" || e.authorize === "any" ? e.authorize : e.authorize.join("+");
      console.log(`${e.id.padEnd(58)} ${e.controller}.${e.action.padEnd(22)} ${auth}`);
    }
    console.log(`\n${list.length} endpoints across ${new Set(list.map((e) => e.controller)).size} controllers`);
    return 0;
  },

  async scaffold(args) {
    const { list } = await endpointMap();
    const written = await scaffoldScenarios(list, PATHS.scenarios, args.flags.get("force") === "true");
    console.log(`scaffolded ${written.length} scenario file(s) into ${path.relative(REPO, PATHS.scenarios)}`);
    for (const file of written) console.log(`  ${file}`);
    console.log(
      "\nEvery step is marked \"todo\": fill in paths, bodies and bindings, then drop the flag.\n" +
        "Capture refuses to record a step still marked todo.",
    );
    return 0;
  },

  async capture(args) {
    const baseUrl = args.flags.get("base-url") ?? DEFAULT_BASE_URL;
    console.log(`capturing from ${baseUrl} (the .NET API)`);
    const exchanges: Exchange[] = [];
    const summary = await run(args, exchanges);
    reportRun(summary);

    if (exchanges.length === 0) {
      console.error("nothing captured");
      return 1;
    }
    const manifest = await writeCorpus(PATHS.fixtures, exchanges, {
      capturedAt: new Date().toISOString(),
      stack: args.flags.get("stack") ?? "dotnet",
      baseUrl,
      basePath: args.flags.get("base-path") ?? DEFAULT_BASE_PATH,
    });
    console.log(
      `\nwrote ${manifest.fixtures} fixtures covering ${manifest.endpoints.length} endpoints ` +
        `to ${path.relative(REPO, PATHS.fixtures)}`,
    );

    // A capture that silently skipped half the corpus is worse than none.
    return summary.failures.length === 0 && summary.skipped.length === 0 ? 0 : 1;
  },

  async replay(args) {
    const baseUrl = args.flags.get("base-url") ?? DEFAULT_BASE_URL;
    console.log(`replaying the corpus against ${baseUrl}`);
    const fixtures = await readCorpus(PATHS.fixtures);
    const exchanges: Exchange[] = [];
    const summary = await run(args, exchanges);
    reportRun(summary);

    const report = buildReport(fixtures, exchanges);
    console.log(`\n${formatReplay(report)}`);
    return report.matched === report.total && summary.failures.length === 0 ? 0 : 1;
  },

  async coverage(args) {
    const { list } = await endpointMap();
    const source = args.flags.get("from") ?? "scenarios";
    const cases =
      source === "fixtures"
        ? (await readCorpus(PATHS.fixtures)).map((f) => ({ endpoint: f.endpoint, role: f.as, kind: f.kind }))
        : (await loadScenarios(PATHS.scenarios)).flatMap((s) =>
            s.steps
              .filter((step) => (step as { todo?: boolean }).todo !== true)
              .map((step) => ({ endpoint: step.endpoint, role: step.as, kind: step.kind })),
          );
    const report = coverageReport(list, cases);
    console.log(`from ${source}\n${formatCoverage(report)}`);
    if (args.flags.get("out")) {
      await writeFile(args.flags.get("out")!, `${JSON.stringify(report, null, 2)}\n`);
    }
    // Coverage reports; only capture and replay gate.
    return 0;
  },

  async help() {
    console.log(
      [
        "golden — the Wave A capture and replay harness",
        "",
        "  inventory [--json]            list the endpoints read from the .NET controllers",
        "  scaffold  [--force]           write a scenario stub per controller, every endpoint x role",
        "  capture   [--base-url URL]    record the corpus from the live .NET API  (slice A2)",
        "  replay    [--base-url URL]    re-run the corpus and diff against it     (slice A3)",
        "  coverage  [--from fixtures]   what the corpus does and does not pin",
        "",
        "Credentials come from the environment: GOLDEN_PASSWORD, or GOLDEN_<ROLE>_PASSWORD",
        `and GOLDEN_<ROLE>_EMAIL per role (${ROLES.join(", ")}).`,
        "",
        "Capture runs against a freshly seeded database; so does replay. Mutating steps",
        "make the corpus order-dependent, which is the price of covering them at all.",
      ].join("\n"),
    );
    return 0;
  },
};

const args = parseArgs(process.argv.slice(2));
const command = commands[args.command] ?? commands.help;
try {
  process.exitCode = await command(args);
} catch (error) {
  // Missing credentials and a missing corpus are operator errors with useful
  // messages; a stack trace on top of one just buries it.
  console.error(`\n${(error as Error).message}`);
  if (args.flags.get("debug") === "true") console.error(error);
  process.exitCode = 1;
}
