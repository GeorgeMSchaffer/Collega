// Volatile-value normalization.
//
// Two runs of the same request differ in ways that are not behaviour: new GUIDs,
// new timestamps, a fresh JWT. A diff that flags those is a diff nobody reads.
// So both sides are normalized before comparison, and the normalization is
// *aliasing* rather than blanking: the first GUID seen becomes <guid:1>, the
// second <guid:2>, and a repeat of the first is <guid:1> again. Identity
// relationships inside a response — "the board this idea belongs to is the board
// I just created" — survive, which is most of what these fixtures are pinning.

export type Alias = { pattern: RegExp; label: string };

const GUID =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/** Response headers worth pinning. The rest are transport noise that differs by stack. */
export const HEADER_ALLOW_LIST = ["content-type", "location", "www-authenticate"];

export class Normalizer {
  #guids = new Map<string, string>();

  /** Stable alias for one GUID, assigned in first-seen order. */
  #guidAlias(value: string): string {
    const key = value.toLowerCase();
    let alias = this.#guids.get(key);
    if (alias === undefined) {
      alias = `<guid:${this.#guids.size + 1}>`;
      this.#guids.set(key, alias);
    }
    return alias;
  }

  string(value: string): string {
    return value
      .replace(JWT, "<jwt>")
      .replace(GUID, (m) => this.#guidAlias(m))
      .replace(ISO_TIMESTAMP, "<timestamp>");
  }

  value(input: unknown): unknown {
    if (typeof input === "string") return this.string(input);
    if (Array.isArray(input)) return input.map((item) => this.value(item));
    if (input && typeof input === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input as Record<string, unknown>).sort()) {
        out[key] = this.value((input as Record<string, unknown>)[key]);
      }
      return out;
    }
    return input;
  }
}

/** Drop the paths a case declares unstable, e.g. "body.expiresAt" or "body.items[].code". */
export function omitPaths(input: unknown, paths: string[]): unknown {
  if (paths.length === 0) return input;
  let out = input;
  for (const path of paths) {
    out = omitOne(out, path.replace(/^body\.?/, "").split(".").filter(Boolean));
  }
  return out;
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

export function normalizeHeaders(headers: Record<string, string>, n: Normalizer) {
  const out: Record<string, string> = {};
  for (const name of HEADER_ALLOW_LIST) {
    const value = headers[name];
    if (value !== undefined) out[name] = n.string(value);
  }
  return out;
}
