// Volatile-value normalization.
//
// Two runs of the same request differ in ways that are not behaviour: new GUIDs,
// new timestamps, a fresh JWT. A diff that flags those is a diff nobody reads.
// So both sides are normalized before comparison — but *how* is the part that
// decides whether this corpus can catch a relation bug.
//
// A GUID is labelled by where it was first seen: <guid@create.body.id>. Every
// later appearance of that same value carries the same label, across steps,
// because the normalizer lives for the whole scenario. So "the board on the idea
// I just read is the board I just created" is pinned — if a rewrite returns a
// different board there, that value was not seen before, it is labelled by its
// own position instead, and the diff reports it.
//
// Ordinal labels (<guid:1>, <guid:2>) cannot do this. Two structurally identical
// responses holding entirely different ids normalize to the same bytes, and the
// most expensive class of defect this corpus exists to catch — a wrong relation,
// a leak across organizations — passes as a match.

export type Alias = { pattern: RegExp; label: string };

const GUID =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/** Response headers worth pinning. The rest are transport noise that differs by stack. */
export const HEADER_ALLOW_LIST = ["content-type", "location", "www-authenticate"];

/**
 * Fields that are credentials, in a request or a response. Never recorded.
 *
 * `invitecode` earns its place the least obviously and matters the most: it is a
 * standing, non-expiring credential that self-registers anyone into an
 * organization, and it comes back on `GET /organizations` and
 * `GET /organizations/{id}` — ordinary list responses that every capture hits,
 * not an endpoint anyone would think to flag.
 */
const SECRET_FIELDS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "oldpassword",
  "temporarypassword",
  "initialpassword",
  "invitecode",
  "accesstoken",
  "token",
  "secret",
  "apikey",
]);

/**
 * Fields that change every request without meaning anything.
 *
 * `traceId` is the one that matters: ASP.NET puts it on every problem-details
 * body, so it rides on every 400, 401, 403 and 404 in the corpus — which is most
 * of the authorization cases, the ones worth pinning hardest. Its two shapes (a
 * connection id like `0HNOA0E675RIH:00000001`, and a W3C traceparent) match no
 * general pattern worth guessing at, so it is handled by name.
 */
const VOLATILE_FIELDS = new Set(["traceid", "requestid", "correlationid"]);

export class Normalizer {
  #labels = new Map<string, string>();
  #used = new Set<string>();

  /**
   * Label for one GUID, by the position it was first seen at. Two different
   * GUIDs first appearing at the same position — array siblings — are told
   * apart by a suffix, so they never collapse into each other.
   */
  #label(value: string, path: string): string {
    const key = value.toLowerCase();
    const held = this.#labels.get(key);
    if (held !== undefined) return held;

    let label = `<guid@${path}>`;
    for (let n = 2; this.#used.has(label); n++) label = `<guid@${path}#${n}>`;
    this.#used.add(label);
    this.#labels.set(key, label);
    return label;
  }

  string(value: string, path = "?"): string {
    return value
      .replace(JWT, "<jwt>")
      .replace(GUID, (m) => this.#label(m, path))
      .replace(ISO_TIMESTAMP, "<timestamp>");
  }

  value(input: unknown, path = "body"): unknown {
    if (typeof input === "string") return this.string(input, path);
    if (Array.isArray(input)) return input.map((item, index) => this.value(item, `${path}[${index}]`));
    if (input && typeof input === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input as Record<string, unknown>).sort()) {
        const value = (input as Record<string, unknown>)[key];
        // Kept as a placeholder rather than dropped, so the field's presence on
        // every problem-details body is still part of what the corpus pins.
        out[key] = VOLATILE_FIELDS.has(key.toLowerCase()) && value !== null
          ? `<${key.toLowerCase()}>`
          : this.value(value, `${path}.${key}`);
      }
      return out;
    }
    return input;
  }
}

/**
 * Strip credentials out of a recorded body, in either direction.
 *
 * The corpus is committed, and capture runs with whatever `GOLDEN_PASSWORD`
 * points at — which is not always the demo seed. So a login step's *request*
 * carries a live password, and nothing downstream needs it: replay re-derives
 * its requests from the scenario files.
 *
 * Responses mint credentials too, and those are worse because they are new:
 * `POST /users/{userId}/temporary-password` returns a working password for a
 * real account, and `POST /organizations/{id}/users/import` returns one per
 * imported row. Both are in the 81, so A2 will record them. Leaving that to a
 * per-scenario `unstable` declaration would make it depend on every author
 * remembering, for a field they have not met yet.
 *
 * Redaction costs no coverage: `<redacted>` appears identically on both sides
 * of a replay, so the field's presence and shape are still pinned.
 */
export function redact(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => redact(item));
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // A null secret is not a secret, it is an answer: a rejected import row
      // gets no password, and a stack that starts issuing one there is a defect
      // the corpus should catch rather than redact away.
      out[key] =
        SECRET_FIELDS.has(key.toLowerCase()) && value !== null && value !== undefined
          ? "<redacted>"
          : redact(value);
    }
    return out;
  }
  return input;
}

/** Drop the paths a case declares unstable: "body.expiresAt", "body.items[].code". */
export function omitPaths(input: unknown, paths: string[]): unknown {
  if (paths.length === 0) return input;
  let out = input;
  for (const path of paths) out = omitOne(out, segmentsOf(path));
  return out;
}

/** "body.items[].code" and "body.items.[].code" both mean "code in every item". */
function segmentsOf(path: string): string[] {
  return path
    .replace(/^body\.?/, "")
    .replace(/\[\]/g, ".[].")
    .split(".")
    .filter(Boolean);
}

function omitOne(node: unknown, segments: string[]): unknown {
  if (segments.length === 0 || node === null || node === undefined) return node;
  const [head, ...rest] = segments;

  if (head === "[]") {
    if (!Array.isArray(node)) return node;
    return node.map((item) => omitOne(item, rest));
  }
  if (Array.isArray(node)) return node.map((item) => omitOne(item, segments));
  if (typeof node !== "object") return node;

  const obj = node as Record<string, unknown>;
  if (!(head in obj)) return obj;
  const copy = { ...obj };
  if (rest.length === 0) delete copy[head];
  else copy[head] = omitOne(copy[head], rest);
  return copy;
}

export function normalizeHeaders(headers: Record<string, string>, n: Normalizer, path = "headers") {
  const out: Record<string, string> = {};
  for (const name of HEADER_ALLOW_LIST) {
    const value = headers[name];
    if (value !== undefined) out[name] = n.string(value, `${path}.${name}`);
  }
  return out;
}
