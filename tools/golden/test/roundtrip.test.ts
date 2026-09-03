// The property that matters: a fresh capture, replayed against the stack it was
// recorded from, comes back clean — and a change in that stack does not.
// If this fails, the harness is measuring itself.

import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readCorpus, writeCorpus } from "../src/corpus.ts";
import { Runner, type Exchange } from "../src/runner.ts";
import { validateScenario, type Scenario } from "../src/scenarios.ts";
import type { Endpoint } from "../src/inventory.ts";
import { buildReport } from "../replay/replay.ts";
import { startStub, STUB_CREDENTIALS, type StubOptions } from "./stub-api.ts";

const ENDPOINTS: Endpoint[] = [
  { id: "POST /auth/login", verb: "POST", route: "/auth/login", controller: "Auth", action: "Login", authorize: "anonymous", params: [], statuses: [200, 401], source: "stub" },
  { id: "GET /auth/me", verb: "GET", route: "/auth/me", controller: "Auth", action: "Me", authorize: "any", params: [], statuses: [200, 401], source: "stub" },
  { id: "POST /organizations/{organizationId}/boards", verb: "POST", route: "/organizations/{organizationId}/boards", controller: "Boards", action: "Create", authorize: "any", params: ["organizationId"], statuses: [201, 400, 401, 403], source: "stub" },
  { id: "GET /boards/{boardId}", verb: "GET", route: "/boards/{boardId}", controller: "Boards", action: "GetById", authorize: "any", params: ["boardId"], statuses: [200, 401, 404], source: "stub" },
];
const BY_ID = new Map(ENDPOINTS.map((e) => [e.id, e]));

const SCENARIO: Scenario = validateScenario(
  {
    name: "boards",
    bind: { orgId: "11111111-2222-3333-4444-555555555555" },
    steps: [
      { id: "login", endpoint: "POST /auth/login", as: "anonymous", kind: "success", expect: 200,
        body: STUB_CREDENTIALS.OrgAdmin, unstable: ["body.expiresInSeconds"] },
      { id: "create", endpoint: "POST /organizations/{organizationId}/boards", as: "OrgAdmin",
        kind: "success", expect: 201, path: "/organizations/{{orgId}}/boards",
        body: { name: "Ideas" }, bind: { boardId: "$.body.id" } },
      { id: "read", endpoint: "GET /boards/{boardId}", as: "OrgAdmin", kind: "success", expect: 200,
        path: "/boards/{{boardId}}" },
      { id: "create.readonly", endpoint: "POST /organizations/{organizationId}/boards", as: "ReadOnly",
        kind: "denied", expect: 403, path: "/organizations/{{orgId}}/boards", body: { name: "Ideas" } },
      { id: "create.invalid", endpoint: "POST /organizations/{organizationId}/boards", as: "OrgAdmin",
        kind: "invalid", expect: 400, path: "/organizations/{{orgId}}/boards", body: {} },
      { id: "read.anonymous", endpoint: "GET /boards/{boardId}", as: "anonymous", kind: "denied",
        expect: 401, path: "/boards/{{boardId}}" },
    ],
  },
  "roundtrip.test",
);

async function runAgainst(stubOptions: StubOptions = {}) {
  const stub = await startStub(stubOptions);
  try {
    const runner = new Runner({
      baseUrl: stub.url,
      basePath: stub.basePath,
      credentials: STUB_CREDENTIALS,
      stopOnError: true,
    });
    return { stub, result: await runner.runScenario(SCENARIO, BY_ID) };
  } finally {
    await stub.close();
  }
}

test("every step runs, and the API agrees with what each one expected", async () => {
  const { result } = await runAgainst();
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.surprises, [], "a surprise means the scenario's expect was wrong");
  assert.equal(result.exchanges.length, SCENARIO.steps.length);
  assert.deepEqual(
    result.exchanges.map((e) => e.response.status),
    [200, 201, 200, 403, 400, 401],
  );
});

test("a capture replayed against the same stack matches, despite fresh guids and tokens", async () => {
  const first = await runAgainst();
  const dir = await mkdtemp(path.join(tmpdir(), "golden-"));
  try {
    await writeCorpus(dir, first.result.exchanges, {
      capturedAt: new Date().toISOString(),
      stack: "stub",
      baseUrl: first.stub.url,
      basePath: first.stub.basePath,
    });
    const fixtures = await readCorpus(dir);
    assert.equal(fixtures.length, SCENARIO.steps.length);

    // A second stub means new guids, a new token and new timestamps throughout.
    const second = await runAgainst();
    const report = buildReport(fixtures, second.result.exchanges);
    assert.equal(report.matched, report.total, JSON.stringify(report.results.filter((r) => r.status !== "match"), null, 2));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a changed response body is caught, and named by path", async () => {
  const first = await runAgainst();
  const dir = await mkdtemp(path.join(tmpdir(), "golden-"));
  try {
    await writeCorpus(dir, first.result.exchanges, {
      capturedAt: new Date().toISOString(),
      stack: "stub",
      baseUrl: first.stub.url,
      basePath: first.stub.basePath,
    });
    const fixtures = await readCorpus(dir);

    // The kind of drift a rewrite produces: a field renamed on the way out.
    const drifted = await runAgainst({
      mutate: (route, body) =>
        route.endsWith("/boards") && "name" in body ? { ...body, title: body.name, name: undefined } : body,
    });
    const report = buildReport(fixtures, drifted.result.exchanges);
    assert.ok(report.matched < report.total, "drift went unnoticed");

    const failure = report.results.find((r) => r.step === "create");
    assert.equal(failure?.status, "body");
    assert.ok(
      failure?.mismatches.some((m) => m.path === "body.name" && m.kind === "missing"),
      `expected a missing body.name, got ${JSON.stringify(failure?.mismatches)}`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an id that stops matching the step that minted it is caught", async () => {
  // The expensive defect: the read comes back attached to a different board than
  // the one just created. Same shape, same field types, wrong relation. Nothing
  // inside a single response says it is wrong — only the earlier step does.
  const first = await runAgainst();
  const dir = await mkdtemp(path.join(tmpdir(), "golden-"));
  try {
    await writeCorpus(dir, first.result.exchanges, {
      capturedAt: new Date().toISOString(),
      stack: "stub",
      baseUrl: first.stub.url,
      basePath: first.stub.basePath,
    });
    const fixtures = await readCorpus(dir);

    const drifted = await runAgainst({
      mutate: (route, body) =>
        /^\/boards\/[\w-]+$/.test(route) && "id" in body
          ? { ...body, id: "cccccccc-4f89-11d3-9a0c-0305e82c3301" }
          : body,
    });
    const report = buildReport(fixtures, drifted.result.exchanges);
    const failure = report.results.find((r) => r.step === "read");
    assert.equal(failure?.status, "body", "a wrong relation replayed as a match");
    assert.ok(failure?.mismatches.some((m) => m.path === "body.id"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("no password reaches a fixture", async () => {
  const first = await runAgainst();
  const dir = await mkdtemp(path.join(tmpdir(), "golden-"));
  try {
    await writeCorpus(dir, first.result.exchanges, {
      capturedAt: new Date().toISOString(),
      stack: "stub",
      baseUrl: first.stub.url,
      basePath: first.stub.basePath,
    });
    // The corpus is committed and capture runs against whatever GOLDEN_PASSWORD
    // points at, so a recorded login body would be a credential in git.
    const files = await readdir(dir);
    for (const file of files) {
      const text = await readFile(path.join(dir, file), "utf8");
      assert.ok(
        !text.includes(STUB_CREDENTIALS.OrgAdmin.password),
        `${file} carries the password used to capture it`,
      );
    }
    const login = (await readCorpus(dir)).find((f) => f.step === "login");
    assert.equal((login?.request.body as Record<string, unknown>).password, "<redacted>");
    assert.equal(
      (login?.request.body as Record<string, unknown>).email,
      STUB_CREDENTIALS.OrgAdmin.email,
      "the identity is the point of the case and stays",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a changed status is reported on its own, not buried under body noise", async () => {
  const first = await runAgainst();
  const dir = await mkdtemp(path.join(tmpdir(), "golden-"));
  try {
    await writeCorpus(dir, first.result.exchanges, {
      capturedAt: new Date().toISOString(),
      stack: "stub",
      baseUrl: first.stub.url,
      basePath: first.stub.basePath,
    });
    const fixtures = await readCorpus(dir);
    const changed = fixtures.map((f) =>
      f.step === "create.readonly" ? { ...f, normalized: { ...f.normalized, status: 401 } } : f,
    );
    const second = await runAgainst();
    const report = buildReport(changed, second.result.exchanges);

    const failure = report.results.find((r) => r.step === "create.readonly");
    assert.equal(failure?.status, "status");
    assert.equal(failure?.mismatches.length, 1);
    assert.deepEqual(
      [failure?.mismatches[0].expected, failure?.mismatches[0].actual],
      [401, 403],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a step whose scenario died earlier is reported absent, not passed over", async () => {
  const first = await runAgainst();
  const dir = await mkdtemp(path.join(tmpdir(), "golden-"));
  try {
    await writeCorpus(dir, first.result.exchanges, {
      capturedAt: new Date().toISOString(),
      stack: "stub",
      baseUrl: first.stub.url,
      basePath: first.stub.basePath,
    });
    const fixtures = await readCorpus(dir);
    const partial: Exchange[] = first.result.exchanges.slice(0, 2);
    const report = buildReport(fixtures, partial);
    assert.equal(report.matched, 2);
    assert.equal(report.results.filter((r) => r.status === "absent").length, fixtures.length - 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("todo steps are skipped rather than captured", async () => {
  const stub = await startStub();
  try {
    const runner = new Runner(
      { baseUrl: stub.url, basePath: stub.basePath, credentials: STUB_CREDENTIALS, stopOnError: true },
    );
    const scaffolded = validateScenario(
      {
        name: "scaffolded",
        steps: [
          { id: "me", endpoint: "GET /auth/me", as: "OrgAdmin", kind: "success", expect: 200 },
          { id: "todo", endpoint: "GET /boards/{boardId}", as: "OrgAdmin", kind: "success", expect: 200, todo: true },
        ],
      },
      "scaffold.test",
    );
    const result = await runner.runScenario(scaffolded, BY_ID);
    assert.equal(result.exchanges.length, 1);
    assert.deepEqual(result.skipped, [{ scenario: "scaffolded", step: "todo" }]);
  } finally {
    await stub.close();
  }
});
