import { randomUUID } from 'node:crypto'
import { type ResolvedIdentity, requestContextStorage } from './request-context.js'

/**
 * Opens a request context outside an HTTP request, for scheduled or queued work.
 *
 * Without this, background work hits NoAmbientIdentityError - which is the intended
 * behaviour, not a gap. Passing an identity is meant to be a deliberate act.
 */
export function runAs<T>(identity: ResolvedIdentity | null, fn: () => T): T {
  return requestContextStorage.run({ identity, requestId: randomUUID() }, fn)
}

/**
 * For work that legitimately has no human actor. `null` means audit rows record
 * actorUserId = null, which the schema already allows.
 */
export const SYSTEM_IDENTITY = null
