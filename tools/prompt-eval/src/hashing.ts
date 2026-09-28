import { createHash } from 'node:crypto'

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** JSON with object keys sorted at every depth, so a hash does not depend on key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

/**
 * A UUID-shaped id from a name: the first 16 bytes of SHA-1(`seed`), with the version and variant
 * bits set as a name-based (v5-style) UUID so it reads like the ids production puts in the prompt
 * (rule 6). The same seed gives the same id on every run and machine.
 */
export function nameDerivedId(seed: string): string {
  const bytes = createHash('sha1').update(seed, 'utf8').digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
