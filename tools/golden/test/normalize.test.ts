import assert from "node:assert/strict";
import { test } from "node:test";

import { Normalizer, normalizeHeaders, omitPaths, redact } from "../src/normalize.ts";
import { diff } from "../src/diff.ts";

const BOARD = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const OTHER = "b1e0a5f2-0000-4000-8000-000000000001";

test("a guid is labelled by where it was first seen, and keeps that label everywhere", () => {
  const n = new Normalizer();
  assert.equal(n.string(BOARD, "create.body.id"), "<guid@create.body.id>");
  assert.equal(n.string(BOARD, "read.body.boardId"), "<guid@create.body.id>");
  assert.equal(n.string(BOARD.toUpperCase(), "x"), "<guid@create.body.id>", "case is not an identity difference");
  assert.equal(n.string(OTHER, "read.body.organizationId"), "<guid@read.body.organizationId>");
});

test("which guid the database minted does not matter — only where it first appeared", () => {
  const left = new Normalizer().value({ id: BOARD }, "create.body");
  const right = new Normalizer().value({ id: OTHER }, "create.body");
  assert.deepEqual(left, right);
});

test("identity relationships survive normalization inside one response", () => {
  const n = new Normalizer();
  const normalized = n.value({ id: BOARD, boardId: BOARD, organizationId: OTHER }, "body") as Record<string, string>;
  assert.equal(normalized.id, normalized.boardId);
  assert.notEqual(normalized.id, normalized.organizationId);
});

test("a relationship that should hold across steps, and does not, is caught", () => {
  // The defect this corpus exists to catch: the idea comes back attached to a
  // different board than the one it was created on. Same shape, wrong relation.
  const captured = new Normalizer();
  captured.value({ id: BOARD }, "create.body");
  const expected = captured.value({ boardId: BOARD }, "read.body");

  const drifted = new Normalizer();
  drifted.value({ id: BOARD }, "create.body");
  const actual = drifted.value({ boardId: OTHER }, "read.body");

  assert.notDeepEqual(expected, actual);
  assert.equal(diff(expected, actual).length, 1);
});

test("two new guids in the same array position do not collapse into each other", () => {
  const n = new Normalizer();
  const normalized = n.value([{ id: BOARD }, { id: OTHER }], "body") as { id: string }[];
  assert.notEqual(normalized[0].id, normalized[1].id);
});

test("timestamps and tokens are flattened", () => {
  const n = new Normalizer();
  assert.equal(n.string("2026-09-03T14:22:05.123Z"), "<timestamp>");
  assert.equal(n.string("2026-09-03T14:22:05+01:00"), "<timestamp>");
  assert.equal(n.string("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln"), "<jwt>");
});

test("credentials never reach a fixture, at any depth", () => {
  const redacted = redact({
    email: "orgadmin@demo.collega.test",
    password: "Abc123!",
    nested: { newPassword: "s3cret", keep: "value" },
    list: [{ currentPassword: "old" }],
  }) as Record<string, unknown>;

  assert.equal(redacted.password, "<redacted>");
  assert.equal((redacted.nested as Record<string, unknown>).newPassword, "<redacted>");
  assert.equal((redacted.list as Record<string, unknown>[])[0].currentPassword, "<redacted>");
  assert.equal(redacted.email, "orgadmin@demo.collega.test", "the identity is the point of the case");
  assert.equal((redacted.nested as Record<string, unknown>).keep, "value");
});

test("object keys are sorted, so serialization order is not a finding", () => {
  const n = new Normalizer();
  assert.deepEqual(
    Object.keys(n.value({ b: 1, a: 2, c: 3 }) as object),
    ["a", "b", "c"],
  );
});

test("omitPaths drops a declared-unstable field, in both documented array forms", () => {
  const body = { code: "XZ12", items: [{ id: 1, seenAt: "now" }, { id: 2, seenAt: "later" }] };
  for (const path of ["body.items[].seenAt", "body.items.[].seenAt"]) {
    const trimmed = omitPaths(body, ["body.code", path]) as typeof body;
    assert.deepEqual(trimmed, { items: [{ id: 1 }, { id: 2 }] }, `"${path}" did nothing`);
  }
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

test("a guid in a location header is labelled like any other", () => {
  const n = new Normalizer();
  n.value({ id: BOARD }, "create.body");
  const headers = normalizeHeaders({ location: `/boards/${BOARD}` }, n, "create.headers");
  assert.equal(headers.location, "/boards/<guid@create.body.id>");
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
