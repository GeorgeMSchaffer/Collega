// The auth rate limits (contracts/auth.md "Rate limiting on the authentication surface"): per
// caller IP and per route, 10 a minute (20 on login) and 100 an hour, answered as the kernel 429
// with `Retry-After` and no other rate-limit header. And the seam the 2026-09-10 review found:
// `Retry-After` is the only thing on the wire that separates this 429 from a locked account's.
//
// The guard runs for real, over the real decorators on `AuthenticationController`, with the
// library's in-process store. Time is faked because the store keys its windows on `Date.now` and
// expires hits with `setTimeout`.

import { LockedOutError, RateLimitedError } from '@collega/application/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ThrottlerStorageService } from '@nestjs/throttler'
import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { AuthGuard } from '../src/auth/auth.guard.js'
import {
  AUTH_BURST_THROTTLER,
  AUTH_HOURLY_THROTTLER,
  AUTH_THROTTLERS,
  AuthRateLimitGuard,
} from '../src/auth/rate-limit.guard.js'
import { AuthenticationController } from '../src/authentication/authentication.controller.js'
import { serverFragment } from '../src/common/config/fragments/server.js'
import { renderProblem } from './problem-render.js'
import { GUARDS_METADATA } from './route-metadata.js'

type Route = 'login' | 'register' | 'changePassword'

/** The module options `app.module.ts` passes, read off the module rather than restated. */
function appThrottlerOptions(): { throttlers: unknown[]; setHeaders?: boolean } {
  const imports = Reflect.getMetadata('imports', AppModule) as { providers?: unknown[] }[]
  for (const entry of imports) {
    for (const provider of entry?.providers ?? []) {
      const value = (provider as { useValue?: { throttlers?: unknown[] } }).useValue
      if (value?.throttlers) return value as { throttlers: unknown[]; setHeaders?: boolean }
    }
  }
  throw new Error('AppModule does not register ThrottlerModule.forRoot')
}

type Harness = {
  hit(route: Route, ip?: string): Promise<{ outcome: unknown; headers: Record<string, unknown> }>
}

async function harness(): Promise<Harness> {
  const guard = new AuthRateLimitGuard(
    appThrottlerOptions() as never,
    new ThrottlerStorageService(),
    new Reflector(),
  )
  await guard.onModuleInit()

  return {
    async hit(route, ip = '203.0.113.7') {
      const headers: Record<string, unknown> = {}
      const request = { ip, headers: {} }
      const response = {
        header: (name: string, value: unknown) => {
          headers[name] = value
        },
      }
      const context = {
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
        getHandler: () => AuthenticationController.prototype[route],
        getClass: () => AuthenticationController,
      } as unknown as ExecutionContext
      const outcome = await guard.canActivate(context).then(
        (v) => v,
        (e: unknown) => e,
      )
      return { outcome, headers }
    },
  }
}

async function hitTimes(h: Harness, route: Route, times: number, ip?: string) {
  const outcomes: unknown[] = []
  for (let i = 0; i < times; i++) outcomes.push((await h.hit(route, ip)).outcome)
  return outcomes
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-29T08:00:00.000Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('The configured limits', () => {
  it('are 10 a minute and 100 an hour', () => {
    expect(AUTH_THROTTLERS).toEqual([
      { name: AUTH_BURST_THROTTLER, ttl: 60_000, limit: 10 },
      { name: AUTH_HOURLY_THROTTLER, ttl: 3_600_000, limit: 100 },
    ])
    expect(appThrottlerOptions().throttlers).toEqual([...AUTH_THROTTLERS])
  })

  it('run with the library headers off', () => {
    expect(appThrottlerOptions().setHeaders).toBe(false)
  })

  it('apply to login, register and change-password, ahead of the session guard', () => {
    const proto = AuthenticationController.prototype
    expect(Reflect.getMetadata(GUARDS_METADATA, proto.login)).toEqual([AuthRateLimitGuard])
    expect(Reflect.getMetadata(GUARDS_METADATA, proto.register)).toEqual([AuthRateLimitGuard])
    expect(Reflect.getMetadata(GUARDS_METADATA, proto.changePassword)).toEqual([
      AuthRateLimitGuard,
      AuthGuard,
    ])
  })
})

describe('Per-minute limit', () => {
  it('lets login through twenty times a minute and refuses the twenty-first', async () => {
    const h = await harness()

    const outcomes = await hitTimes(h, 'login', 21)

    expect(outcomes.slice(0, 20).every((o) => o === true)).toBe(true)
    expect(outcomes[20]).toBeInstanceOf(RateLimitedError)
  })

  it.each<Route>(['register', 'changePassword'])(
    'lets %s through ten times a minute and refuses the eleventh',
    async (route) => {
      const h = await harness()

      const outcomes = await hitTimes(h, route, 11)

      expect(outcomes.slice(0, 10).every((o) => o === true)).toBe(true)
      expect(outcomes[10]).toBeInstanceOf(RateLimitedError)
    },
  )

  it('opens again once the minute is over', async () => {
    const h = await harness()
    await hitTimes(h, 'register', 11)

    await vi.advanceTimersByTimeAsync(61_000)

    expect((await h.hit('register')).outcome).toBe(true)
  })
})

describe('Per-hour limit', () => {
  it('refuses the hundred-and-first request in an hour even when each minute stays under ten', async () => {
    const h = await harness()
    for (let minute = 0; minute < 10; minute++) {
      const outcomes = await hitTimes(h, 'register', 10)
      expect(outcomes.every((o) => o === true)).toBe(true)
      await vi.advanceTimersByTimeAsync(61_000)
    }

    const { outcome } = await h.hit('register')

    expect(outcome).toBeInstanceOf(RateLimitedError)
    expect((outcome as RateLimitedError).retryAfterSeconds).toBeGreaterThan(60)
  })
})

describe('Buckets are per route and per caller IP', () => {
  it('spending the register allowance leaves login open', async () => {
    const h = await harness()
    await hitTimes(h, 'register', 11)

    expect((await h.hit('login')).outcome).toBe(true)
  })

  it('one address hitting the limit leaves another open', async () => {
    const h = await harness()
    await hitTimes(h, 'register', 11, '203.0.113.7')

    expect((await h.hit('register', '198.51.100.2')).outcome).toBe(true)
  })
})

describe('The 429 on the wire', () => {
  it('is the kernel too-many-requests problem with Retry-After in seconds', async () => {
    const h = await harness()
    const outcomes = await hitTimes(h, 'register', 11)

    const rendered = renderProblem(outcomes[10], '/api/v1/auth/register')

    expect(rendered.status).toBe(429)
    expect(rendered.body.type).toBe('https://collega.dev/problems/too-many-requests')
    expect(rendered.headers['retry-after']).toBe('60')
  })

  it('sends no X-RateLimit or suffixed Retry-After header, refused or not', async () => {
    const h = await harness()
    const seen: string[] = []
    for (let i = 0; i < 11; i++) seen.push(...Object.keys((await h.hit('register')).headers))

    expect(seen).toEqual([])
  })

  it("differs from a locked account's 429 only by Retry-After", () => {
    const limiter = renderProblem(new RateLimitedError('Too many attempts.', 60))
    const lockout = renderProblem(new LockedOutError('This account is locked.'))

    expect(lockout.status).toBe(limiter.status)
    expect(lockout.body.type).toBe(limiter.body.type)
    expect(lockout.body.title).toBe(limiter.body.title)
    expect(limiter.headers['retry-after']).toBe('60')
    expect(lockout.headers).not.toHaveProperty('retry-after')
  })
})

describe('Which address the limiter sees', () => {
  it('trusts one proxy hop on Vercel and none anywhere else', () => {
    const hops = (env: NodeJS.ProcessEnv) => serverFragment.read(env, []).trustedProxyHops

    expect(hops({ VERCEL: '1' })).toBe(1)
    expect(hops({})).toBe(0)
    expect(hops({ VERCEL: '0' })).toBe(0)
  })

  it.each([
    [0, '10.0.0.5'],
    [1, '203.0.113.7'],
  ])(
    'with %i trusted hops, a request carrying x-forwarded-for is keyed on %s',
    (hops, expected) => {
      const app = express()
      app.set('trust proxy', hops)
      const request = Object.create(app.request, {
        headers: { value: { 'x-forwarded-for': '203.0.113.7' } },
        socket: { value: { remoteAddress: '10.0.0.5' } },
        connection: { value: { remoteAddress: '10.0.0.5' } },
      }) as { ip: string }

      expect(request.ip).toBe(expected)
    },
  )
})
