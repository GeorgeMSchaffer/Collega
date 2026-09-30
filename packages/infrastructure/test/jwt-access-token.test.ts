// The session cookie's value (contracts/auth.md "Access Token Format and Session Revocation";
// SPEC/20-feature-auth.md requirements 35 and 37): an HS256 JWT naming the user in `sub` and the
// issuing security stamp in `sstamp`, expiring absolutely at issue time plus the configured
// lifetime. This class checks signature and expiry only; the stamp comparison is
// `TokenAuthenticationService`'s, covered in packages/application.
//
// Every time here is an explicit `nowUtc`, never the wall clock - which is also what the service's
// `noTimestamp`/`clockTimestamp` options exist to allow.

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { JwtAccessTokenService } from '../src/security/jwt-access-token.service.js'

const KEY = 'k'.repeat(48)
const LIFETIME_SECONDS = 480 * 60
const ISSUED = new Date('2026-09-29T08:00:00.000Z')

const service = new JwtAccessTokenService({ signingKey: KEY, lifetimeSeconds: LIFETIME_SECONDS })

/**
 * A JWT built by hand rather than with `jsonwebtoken`, which only the chokepoint may import. HMAC
 * for the HS algorithms, an empty signature for `none`.
 */
function craft(alg: 'HS256' | 'HS512' | 'none', payload: object, key = KEY): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg, typ: 'JWT' })}.${encode(payload)}`
  if (alg === 'none') return `${unsigned}.`
  const hash = alg === 'HS256' ? 'sha256' : 'sha512'
  return `${unsigned}.${createHmac(hash, key).update(unsigned).digest('base64url')}`
}

function secondsAfter(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}

describe('JwtAccessTokenService.issue', () => {
  it('signs HS256 with sub, sstamp and an exp exactly the lifetime after issue', () => {
    const { token, expiresInSeconds } = service.issue('user-1', 'STAMP-1', ISSUED)

    const [header, payload] = token
      .split('.')
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')))
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
    // No `iat`: `noTimestamp` drops the explicit one too. Nothing reads it; `exp` is the deadline.
    expect(payload).toEqual({
      sub: 'user-1',
      sstamp: 'STAMP-1',
      exp: ISSUED.getTime() / 1000 + 28_800,
    })
    expect(expiresInSeconds).toBe(28_800)
  })
})

describe('JwtAccessTokenService.tryValidate', () => {
  it('reads back the user and the stamp it was issued over', () => {
    const { token } = service.issue('user-1', 'STAMP-1', ISSUED)

    expect(service.tryValidate(token, ISSUED)).toEqual({
      userId: 'user-1',
      securityStamp: 'STAMP-1',
    })
  })

  it('accepts a token a second before it expires and refuses it at its expiry', () => {
    const { token } = service.issue('user-1', 'STAMP-1', ISSUED)

    expect(service.tryValidate(token, secondsAfter(ISSUED, LIFETIME_SECONDS - 1))).not.toBeNull()
    expect(service.tryValidate(token, secondsAfter(ISSUED, LIFETIME_SECONDS))).toBeNull()
  })

  it('refuses a token signed with another key', () => {
    const other = new JwtAccessTokenService({ signingKey: 'x'.repeat(48), lifetimeSeconds: 60 })
    const { token } = other.issue('user-1', 'STAMP-1', ISSUED)

    expect(service.tryValidate(token, ISSUED)).toBeNull()
  })

  it('refuses a token whose payload was edited after signing', () => {
    const { token } = service.issue('user-1', 'STAMP-1', ISSUED)
    const [header, , signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ sub: 'site-admin', sstamp: 'STAMP-1', iat: 0, exp: 4_102_444_800 }),
    ).toString('base64url')

    expect(service.tryValidate(`${header}.${forged}.${signature}`, ISSUED)).toBeNull()
  })

  it('refuses an unsigned token', () => {
    const unsigned = craft('none', { sub: 'user-1', sstamp: 'STAMP-1' })

    expect(service.tryValidate(unsigned, ISSUED)).toBeNull()
  })

  it('refuses a token signed with the right key under another algorithm', () => {
    const hs512 = craft('HS512', { sub: 'user-1', sstamp: 'STAMP-1' })

    expect(service.tryValidate(hs512, ISSUED)).toBeNull()
  })

  it('refuses a validly signed token that names no user', () => {
    const noSubject = craft('HS256', { sstamp: 'STAMP-1' })

    expect(service.tryValidate(noSubject, ISSUED)).toBeNull()
  })

  it('reads a missing stamp as empty, which no account holds', () => {
    const noStamp = craft('HS256', { sub: 'user-1' })

    expect(service.tryValidate(noStamp, ISSUED)).toEqual({ userId: 'user-1', securityStamp: '' })
  })

  it('refuses something that is not a token at all', () => {
    expect(service.tryValidate('not-a-jwt', ISSUED)).toBeNull()
    expect(service.tryValidate('', ISSUED)).toBeNull()
  })
})
