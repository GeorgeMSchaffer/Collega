import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import type { PasswordHasher } from '@collega/application/auth'

const PREFIX = 'PBKDF2'
const SALT_SIZE_BYTES = 16
const HASH_SIZE_BYTES = 32
const ITERATIONS = 100_000
const DIGEST = 'sha256'

/**
 * PBKDF2 (RFC 2898) password hashing via Node's `node:crypto` - ports .NET's
 * `Pbkdf2PasswordHasher` byte-for-byte, including its stored format
 * (`PBKDF2.{iterations}.{saltBase64}.{hashBase64}`), so an iteration-count upgrade later doesn't
 * invalidate existing hashes.
 */
export class Pbkdf2PasswordHasher implements PasswordHasher {
  hash(password: string): string {
    const salt = randomBytes(SALT_SIZE_BYTES)
    const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_SIZE_BYTES, DIGEST)
    return [PREFIX, ITERATIONS, salt.toString('base64'), hash.toString('base64')].join('.')
  }

  verify(password: string, passwordHash: string): boolean {
    const parts = passwordHash.split('.')
    const [prefix, iterationsText, saltBase64, hashBase64] = parts
    if (
      parts.length !== 4 ||
      prefix !== PREFIX ||
      iterationsText === undefined ||
      saltBase64 === undefined ||
      hashBase64 === undefined
    ) {
      return false
    }

    const iterations = Number(iterationsText)
    if (!Number.isInteger(iterations) || iterations <= 0) {
      return false
    }

    const salt = Buffer.from(saltBase64, 'base64')
    const expectedHash = Buffer.from(hashBase64, 'base64')
    const actualHash = pbkdf2Sync(password, salt, iterations, expectedHash.length, DIGEST)

    return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash)
  }
}
