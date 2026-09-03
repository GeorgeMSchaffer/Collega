import assert from "node:assert/strict";
import { test } from "node:test";

import { Normalizer, normalizeHeaders, omitPaths } from "../src/normalize.ts";
import { diff } from "../src/diff.ts";

test("the same guid gets the same alias, a different one does not", () => {
  const n = new Normalizer();
  const a = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  const b = "b1e0a5f2-0000-4000-8000-000000000001";
  assert.equal(n.string(a), "<guid:1>");
  assert.equal(n.string(b), "<guid:2>");
  assert.equal(n.string(a.toUpperCase()), "<guid:1>", "case is not an identity difference");
});

test("aliases are per-run, so two responses compare on shape not on which guid came first", () => {
  const left = new Normalizer().value({ id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" });
  const right = new Normalizer().value({ id: "ffffffff-4f89-11d3-9a0c-0305e82c3301" });
  assert.deepEqual(left, right);
});

test("identity relationships survive normalization", () => {
  const board = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  const other = "b1e0a5f2-0000-4000-8000-000000000001";
  const n = new Normalizer();
  const normalized = n.value({ id: board, boardId: board, organizationId: other }) as Record<string, string>;
  assert.equal(normalized.id, normalized.boardId);
  assert.notEqual(normalized.id, normalized.organizationId);
});

test("timestamps and tokens are flattened", () => {
  const n = new Normalizer();
  assert.equal(n.string("2026-09-03T14:22:05.123Z"), "<timestamp>");
  assert.equal(n.string("2026-09-03T14:22:05+01:00"), "<timestamp>");
  assert.equal(n.string("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln"), "<jwt>");
});

test("object keys are sorted, so serialization order is not a finding", () => {
  const n = new Normalizer();
  assert.deepEqual(
    Object.keys(n.value({ b: 1, a: 2, c: 3 }) as object),
    ["a", "b", "c"],
  );
});

test("omitPaths drops a declared-unstable field, including through arrays", () => {
  const body = { code: "XZ12", items: [{ id: 1, seenAt: "now" }, { id: 2, seenAt: "later" }] };
  const trimmed = omitPaths(body, ["body.code", "body.items.[].seenAt"]) as typeof body;
  assert.deepEqual(trimmed, { items: [{ id: 1 }, { id: 2 }] });
  assert.deepEqual(body.items[0], { id: 1, seenAt: "now" }, "the input is not mutated");
});

test("only the allow-listed headers are compared", () => {
  const n = new Normalizer();
  const headers = normalizeHeaders(
    { "content-type": "application/json", date: "Thu, 03 Sep 2026 14:00:00 GMT", "x-trace": "abc" },
    n,
  );
  assert.deepEqual(headers, { "content-type": "application/json" });
});

test("a location header keeps its guid alias", () => {
  const n = new Normalizer();
  const headers = normalizeHeaders({ location: "/boards/3f2504e0-4f89-11d3-9a0c-0305e82c3301" }, n);
  assert.equal(headers.location, "/boards/<guid:1>");
});

test("diff names the path that moved, not the whole body", () => {
  const mismatches = diff({ a: { b: 1 }, c: 2 }, { a: { b: 9 }, c: 2 });
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].path, "body.a.b");
  assert.equal(mismatches[0].kind, "value");
});

test("diff reports missing and extra keys separately", () => {
  const mismatches = diff({ a: 1, b: 2 }, { a: 1, c: 3 });
  assert.deepEqual(
    mismatches.map((m) => [m.path, m.kind]).sort(),
    [["body.b", "missing"], ["body.c", "extra"]],
  );
});

test("diff reports array length once rather than per element", () => {
  const mismatches = diff([1, 2, 3], [1, 2]);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].kind, "length");
});

test("a string that looks like a number is a type mismatch", () => {
  const mismatches = diff({ count: 3 }, { count: "3" });
  assert.equal(mismatches[0].kind, "type");
});
