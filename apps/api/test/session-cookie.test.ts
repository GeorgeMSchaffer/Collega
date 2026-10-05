// The session cookie (contracts/auth.md `POST /auth/login` "Session transport"; SPEC/20-feature-auth
// requirement 33): `collega_session`, HttpOnly, Secure, SameSite=Lax, Path=/, living exactly as
// long as the token, set by login and by nothing else, and never echoed in a response body.
//
// The attributes are asserted on the `Set-Cookie` string Express actually writes, not on the
// options object, so a serializer quirk would show up here.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AuthService, LoginResult } from '@collega/application/auth'
import type { CurrentUserContext } from '@collega/application/common'
import express, { type Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME, setSessionCookie } from '../src/auth/session-cookie.js'
import { AuthenticationController } from '../src/authentication/authentication.controller.js'
import type { AlsCurrentUserContext } from '../src/common/request-context/als-current-user-context.js'

/** A real Express response whose header writes are captured instead of sent. */
function capturingResponse(): { res: Response; setCookies: string[] } {
  const setCookies: string[] = []
  const res = Object.create(express().response) as Response
  Object.assign(res, {
    req: {},
    append(name: string, value: string | string[]) {
      if (name.toLowerCase() === 'set-cookie') setCookies.push(...[value].flat())
      return res
    },
  })
  return { res, setCookies }
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-29T08:00:00.000Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('setSessionCookie', () => {
  it('writes collega_session as HttpOnly, Secure, SameSite=Lax on Path=/ for the token lifetime', () => {
    const { res, setCookies } = capturingResponse()

    setSessionCookie(res, 'header.payload.signature', 28_800)

    expect(setCookies).toHaveLength(1)
    const [pair, ...attributes] = (setCookies[0] ?? '').split('; ')
    expect(pair).toBe(`${SESSION_COOKIE_NAME}=header.payload.signature`)
    expect(attributes).toEqual(
      expect.arrayContaining([
        'Max-Age=28800',
        'Path=/',
        'Expires=Tue, 29 Sep 2026 16:00:00 GMT',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
      ]),
    )
    expect(attributes).toHaveLength(6)
    expect(setCookies[0]).not.toMatch(/Domain=/i)
  })
})

describe('POST /auth/login', () => {
  const result: LoginResult = {
    accessToken: 'header.payload.signature',
    expiresInSeconds: 28_800,
    requiresPasswordChange: true,
    user: { userId: 'user-1' } as LoginResult['user'],
  }

  function controller(): AuthenticationController {
    const auth = { login: async () => result } as unknown as AuthService
    return new AuthenticationController(auth, {} as CurrentUserContext, {} as AlsCurrentUserContext)
  }

  it('puts the token in the cookie and nowhere in the body', async () => {
    const { res, setCookies } = capturingResponse()

    const body = await controller().login({ email: 'a@b.test', password: 'Abc123!' }, res)

    expect(setCookies[0]).toMatch(/^collega_session=header\.payload\.signature;/)
    expect(body).toEqual({
      expiresInSeconds: 28_800,
      requiresPasswordChange: true,
      user: { userId: 'user-1' },
    })
    expect(JSON.stringify(body)).not.toContain('header.payload.signature')
  })
})

describe('Only login sets the session cookie', () => {
  it('no other source file calls setSessionCookie or writes the cookie by name', () => {
    const src = join(import.meta.dirname, '../src')
    const writers = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => {
        const text = readFileSync(join(src, file), 'utf8')
        return /setSessionCookie\(|clearSessionCookie\(|\.cookie\(|\.clearCookie\(/.test(text)
      })
      .map((file) => file.replaceAll('\\', '/'))
      .sort()

    // session-cookie.ts defines the writers; the authentication controller is login's only caller.
    expect(writers).toEqual([
      'auth/session-cookie.ts',
      'authentication/authentication.controller.ts',
    ])
  })

  it('the authentication controller sets it once, from login', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../src/authentication/authentication.controller.ts'),
      'utf8',
    )

    expect(source.match(/setSessionCookie\(/g)).toHaveLength(1)
    const login = source.slice(source.indexOf('async login('), source.indexOf('async me('))
    expect(login).toContain('setSessionCookie(res, result.accessToken')
  })

  it('View As start and exit take no response object, so they cannot touch the cookie', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../src/view-as/view-as.controller.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/@Res\(|@Response\(|@Next\(/)
    expect(source).not.toMatch(/cookie\s*\(/i)
  })
})
