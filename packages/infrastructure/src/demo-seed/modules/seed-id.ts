import { createHash } from 'node:crypto'

// Kept free of the scenario's imports: the bootstrap scripts run under plain `node`, which cannot
// resolve the `.js` specifiers that `scenario.ts` uses for its sibling modules.

/** A fixed namespace, so ids are stable across runs but cannot collide with real data. */
const NAMESPACE = 'collega.demo.seed.v1'

/**
 * A UUID derived from a name (RFC 4122 §4.3, SHA-1, version 5). Same name in, same uuid out,
 * on any machine.
 */
export function seedId(...parts: readonly string[]): string {
  const digest = createHash('sha1')
    .update(`${NAMESPACE}:${parts.join(':')}`)
    .digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  // Version 5, RFC 4122 variant.
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6)
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8)
  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}
