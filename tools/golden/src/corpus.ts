// Reading and writing the corpus.
//
// One file per exchange, named by scenario and step, so a git diff on a
// re-capture reads as "these cases changed" rather than one 3MB blob.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Exchange } from "./runner.ts";
import { Normalizer, normalizeHeaders, omitPaths } from "./normalize.ts";

export const CORPUS_VERSION = 1;

export type Fixture = Exchange & {
  corpusVersion: number;
  /** Normalized response, which is what replay compares. */
  normalized: { status: number; headers: Record<string, string>; body: unknown };
};

export type CorpusManifest = {
  corpusVersion: number;
  capturedAt: string;
  /** The stack the corpus was recorded from — .NET now, never overwritten by a Nest replay. */
  stack: string;
  baseUrl: string;
  basePath: string;
  fixtures: number;
  scenarios: string[];
  /** Endpoint ids the corpus touches, for coverage reporting. */
  endpoints: string[];
};

/** The comparable form of a response: normalized, with declared-unstable paths dropped. */
export function normalizeExchange(exchange: Exchange) {
  const normalizer = new Normalizer();
  const body = omitPaths(exchange.response.body, exchange.unstable);
  return {
    status: exchange.response.status,
    headers: normalizeHeaders(exchange.response.headers, normalizer),
    body: normalizer.value(body),
  };
}

export function fixtureName(exchange: Exchange): string {
  return `${exchange.scenario}.${exchange.step}.json`;
}

export async function writeCorpus(
  dir: string,
  exchanges: Exchange[],
  manifest: Omit<CorpusManifest, "corpusVersion" | "fixtures" | "scenarios" | "endpoints">,
): Promise<CorpusManifest> {
  await mkdir(dir, { recursive: true });
  for (const exchange of exchanges) {
    const fixture: Fixture = {
      ...exchange,
      corpusVersion: CORPUS_VERSION,
      normalized: normalizeExchange(exchange),
    };
    await writeFile(path.join(dir, fixtureName(exchange)), `${JSON.stringify(fixture, null, 2)}\n`);
  }
  const full: CorpusManifest = {
    ...manifest,
    corpusVersion: CORPUS_VERSION,
    fixtures: exchanges.length,
    scenarios: [...new Set(exchanges.map((e) => e.scenario))].sort(),
    endpoints: [...new Set(exchanges.map((e) => e.endpoint))].sort(),
  };
  await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(full, null, 2)}\n`);
  return full;
}

export async function readCorpus(dir: string): Promise<Fixture[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    throw new Error(`no corpus at ${dir} — run "capture" against the .NET API first`);
  }
  const fixtures: Fixture[] = [];
  for (const file of files.filter((f) => f.endsWith(".json") && f !== "manifest.json").sort()) {
    const fixture = JSON.parse(await readFile(path.join(dir, file), "utf8")) as Fixture;
    if (fixture.corpusVersion !== CORPUS_VERSION) {
      throw new Error(
        `${file} is corpus version ${fixture.corpusVersion}, this harness reads ${CORPUS_VERSION} — re-capture`,
      );
    }
    fixtures.push(fixture);
  }
  if (fixtures.length === 0) throw new Error(`no fixtures in ${dir}`);
  return fixtures;
}
