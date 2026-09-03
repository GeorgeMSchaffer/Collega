import assert from "node:assert/strict";
import { test } from "node:test";

import { interpolate, pluck, validateScenario } from "../src/scenarios.ts";

const ok = {
  name: "boards",
  steps: [{ id: "list", endpoint: "GET /boards/{boardId}", as: "OrgAdmin", kind: "success", expect: 200 }],
};

test("a well-formed scenario validates and carries its filename", () => {
  const scenario = validateScenario(ok, "boards.json");
  assert.equal(scenario.file, "boards.json");
  assert.equal(scenario.steps.length, 1);
});

test("validation rejects the mistakes a hand-written corpus actually makes", () => {
  const cases: [string, unknown][] = [
    ["no steps", { name: "x", steps: [] }],
    ["missing endpoint", { name: "x", steps: [{ id: "a", as: "User", kind: "success", expect: 200 }] }],
    ["endpoint without a verb", { name: "x", steps: [{ ...ok.steps[0], endpoint: "/boards" }] }],
    ["unknown role", { name: "x", steps: [{ ...ok.steps[0], as: "Admin" }] }],
    ["unknown kind", { name: "x", steps: [{ ...ok.steps[0], kind: "happy" }] }],
    ["no expect", { name: "x", steps: [{ id: "a", endpoint: "GET /x", as: "User", kind: "success" }] }],
    ["duplicate step ids", { name: "x", steps: [ok.steps[0], ok.steps[0]] }],
    ["body and text together", { name: "x", steps: [{ ...ok.steps[0], body: {}, text: "a,b" }] }],
  ];
  for (const [why, raw] of cases) {
    assert.throws(() => validateScenario(raw, "bad.json"), /bad\.json/, `accepted ${why}`);
  }
});

test("a lone {{var}} keeps its type; an embedded one stringifies", () => {
  const vars = new Map<string, unknown>([["count", 3], ["id", "abc"]]);
  assert.equal(interpolate("{{count}}", vars), 3);
  assert.equal(interpolate("/boards/{{id}}/ideas", vars), "/boards/abc/ideas");
  assert.deepEqual(interpolate({ n: "{{count}}", list: ["{{id}}"] }, vars), { n: 3, list: ["abc"] });
});

test("an unbound variable says which one and where to bind it", () => {
  assert.throws(
    () => interpolate("/boards/{{missing}}", new Map()),
    /unbound variable \{\{missing\}\}/,
  );
});

test("pluck reads bodies, arrays and headers", () => {
  const source = {
    body: { id: "b1", swimlanes: [{ id: "s1" }, { id: "s2" }] },
    headers: { location: "/boards/b1" },
  };
  assert.equal(pluck("$.body.id", source), "b1");
  assert.equal(pluck("$.body.swimlanes[1].id", source), "s2");
  assert.equal(pluck("$.headers.location", source), "/boards/b1");
});

test("pluck fails loudly rather than binding undefined", () => {
  const source = { body: { id: "b1" }, headers: {} };
  assert.throws(() => pluck("$.body.nope", source), /resolved to undefined/);
  assert.throws(() => pluck("body.id", source), /must start with/);
});

test("pluck collects a field from every element, which the reorder endpoints need", () => {
  const source = {
    body: [{ statusId: "s1", name: "New" }, { statusId: "s2", name: "Done" }],
    headers: {},
  };
  assert.deepEqual(pluck("$.body[*].statusId", source), ["s1", "s2"]);
  assert.deepEqual(pluck("$.body[*]", source), source.body);
});

test("a projection over something that is not an array says so", () => {
  assert.throws(
    () => pluck("$.body[*].id", { body: { id: "one" }, headers: {} }),
    /used \[\*\] on a non-array/,
  );
});
