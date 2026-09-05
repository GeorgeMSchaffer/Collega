// Structural diff over normalized JSON.
//
// The output is a list of paths, because "the response changed" is not a finding
// anybody can act on and a whole-body dump buries the one line that matters.

export type Mismatch = {
  path: string;
  expected: unknown;
  actual: unknown;
  kind: "value" | "type" | "missing" | "extra" | "length";
};

export function diff(expected: unknown, actual: unknown, path = "body"): Mismatch[] {
  if (expected === actual) return [];

  const bothArrays = Array.isArray(expected) && Array.isArray(actual);
  if (bothArrays) {
    const out: Mismatch[] = [];
    if (expected.length !== actual.length) {
      out.push({ path, expected: expected.length, actual: actual.length, kind: "length" });
    }
    const shared = Math.min(expected.length, actual.length);
    for (let i = 0; i < shared; i++) out.push(...diff(expected[i], actual[i], `${path}[${i}]`));
    return out;
  }

  const expectedIsObject = expected !== null && typeof expected === "object" && !Array.isArray(expected);
  const actualIsObject = actual !== null && typeof actual === "object" && !Array.isArray(actual);

  if (expectedIsObject && actualIsObject) {
    const out: Mismatch[] = [];
    const left = expected as Record<string, unknown>;
    const right = actual as Record<string, unknown>;
    for (const key of Object.keys(left)) {
      if (!(key in right)) {
        out.push({ path: `${path}.${key}`, expected: left[key], actual: undefined, kind: "missing" });
        continue;
      }
      out.push(...diff(left[key], right[key], `${path}.${key}`));
    }
    for (const key of Object.keys(right)) {
      if (!(key in left)) {
        out.push({ path: `${path}.${key}`, expected: undefined, actual: right[key], kind: "extra" });
      }
    }
    return out;
  }

  if (expectedIsObject !== actualIsObject || Array.isArray(expected) !== Array.isArray(actual)) {
    return [{ path, expected, actual, kind: "type" }];
  }
  if (typeof expected !== typeof actual) return [{ path, expected, actual, kind: "type" }];
  return [{ path, expected, actual, kind: "value" }];
}

function show(value: unknown): string {
  if (value === undefined) return "(absent)";
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function formatMismatches(mismatches: Mismatch[], indent = "    "): string {
  return mismatches
    .map((m) => `${indent}${m.path}: expected ${show(m.expected)}, got ${show(m.actual)}`)
    .join("\n");
}
