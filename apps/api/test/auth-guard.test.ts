// The one place a credential is read (AGENTS.md "Identity"), and the mandatory password-rotation
// gate (SPEC/20-feature-auth.md 32a; contracts/auth.md "Mandatory Password Rotation Gate").
//
// The allowlist test reads every controller in `src/`, not a list written here: the rule is that a
// NEW endpoint is closed during rotation unless someone opts it in, so the assertion has to see
// endpoints added after it was written.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AuthenticatedPrincipal, TokenAuthenticationService } from '@collega/application/auth'
import { ForbiddenError } from '@collega/application/common'
import { Role } from '@collega/domain/enums'
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it } from 'vitest'
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY } from '../src/auth/allow-while-password-change-required.decorator.js'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { SESSION_COOKIE_NAME } from '../src/auth/session-cookie.js'
import { AuthenticationController } from '../src/authentication/authentication.controller.js'
import {
  type RequestContext,
  requestContextStorage,
} from '../src/common/request-context/request-context.js'
import { UsersController } from '../src/users/users.controller.js'
import { renderProblem } from './problem-render.js'
import { PATH_METADATA } from './route-metadata.js'

const PRINCIPAL: AuthenticatedPrincipal = {
  userId: 'user-1',
  organizationId: 'org-a',
  role: Role.User,
  firstName: 'Ann',
  lastName: 'Author',
  email: 'ann@acme.test',
  status: 'Active' as AuthenticatedPrincipal['status'],
  mustChangePassword: false,
  impersonation: null,
}

type Seen = { tokens: string[] }

function guardAnswering(principal: AuthenticatedPrincipal | null): {
  guard: AuthGuard
  seen: Seen
} {
  const seen: Seen = { tokens: [] }
  const tokens = {
    authenticate: async (token: string) => {
      seen.tokens.push(token)
      return principal
    },
  } as unknown as TokenAuthenticationService
  return { guard: new AuthGuard(tokens, new Reflector()), seen }
}

function contextFor(request: object, handler: object, controller: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext
}

async function activate(
  guard: AuthGuard,
  request: object,
  handler: object = UsersController.prototype.getById,
  controller: object = UsersController,
): Promise<{ outcome: unknown; store: RequestContext }> {
  const store: RequestContext = { identity: null, requestId: 'r-1' }
  const outcome = await requestContextStorage.run(store, () =>
    guard.canActivate(contextFor(request, handler, controller)).then(
      (value) => value,
      (error: unknown) => error,
    ),
  )
  return { outcome, store }
}

describe('AuthGuard - reading the session', () => {
  it('reads the collega_session cookie and writes the principal into the request context', async () => {
    const { guard, seen } = guardAnswering(PRINCIPAL)

    const { outcome, store } = await activate(guard, { cookies: { [SESSION_COOKIE_NAME]: 'tok' } })

    expect(outcome).toBe(true)
    expect(seen.tokens).toEqual(['tok'])
    expect(store.identity).toMatchObject({
      userId: 'user-1',
      role: Role.User,
      isImpersonating: false,
    })
  })

  it('refuses a request with no cookie with the framework 401, without resolving anything', async () => {
    const { guard, seen } = guardAnswering(PRINCIPAL)

    const { outcome, store } = await activate(guard, { cookies: {} })

    expect(outcome).toBeInstanceOf(UnauthorizedException)
    expect(seen.tokens).toEqual([])
    expect(store.identity).toBeNull()
  })

  it('ignores a bearer token: the cookie is the only credential', async () => {
    const { guard, seen } = guardAnswering(PRINCIPAL)

    const { outcome } = await activate(guard, {
      cookies: {},
      headers: { authorization: 'Bearer tok' },
    })

    expect(outcome).toBeInstanceOf(UnauthorizedException)
    expect(seen.tokens).toEqual([])
  })

  it('refuses a cookie the token service rejects (expired, revoked, re-signed) with 401', async () => {
    const { guard } = guardAnswering(null)

    const { outcome, store } = await activate(guard, { cookies: { [SESSION_COOKIE_NAME]: 'old' } })

    expect(outcome).toBeInstanceOf(UnauthorizedException)
    expect(store.identity).toBeNull()
    expect(renderProblem(outcome).status).toBe(401)
  })
})

describe('AuthGuard - the mandatory rotation gate (rule 32a)', () => {
  const rotating = { ...PRINCIPAL, mustChangePassword: true }
  const cookie = { cookies: { [SESSION_COOKIE_NAME]: 'tok' } }

  it('refuses an endpoint off the allowlist with the kernel 403, and resolves no identity', async () => {
    const { guard } = guardAnswering(rotating)

    const { outcome, store } = await activate(guard, cookie)

    expect(outcome).toBeInstanceOf(ForbiddenError)
    expect(store.identity).toBeNull()
    const rendered = renderProblem(outcome, '/api/v1/users')
    expect(rendered.status).toBe(403)
    expect(rendered.body.type).toBe('https://collega.dev/problems/forbidden')
  })

  it.each([
    ['GET /auth/me', AuthenticationController.prototype.me],
    ['POST /auth/change-password', AuthenticationController.prototype.changePassword],
  ])('lets %s through', async (_route, handler) => {
    const { guard } = guardAnswering(rotating)

    const { outcome } = await activate(guard, cookie, handler, AuthenticationController)

    expect(outcome).toBe(true)
  })

  it('refuses the other /auth routes a signed-in reader could reach', async () => {
    const { guard } = guardAnswering(rotating)
    const proto = AuthenticationController.prototype

    for (const handler of [proto.updateMe, proto.updatePortrait, proto.removePortrait]) {
      const { outcome } = await activate(guard, cookie, handler, AuthenticationController)
      expect(outcome).toBeInstanceOf(ForbiddenError)
    }
  })
})

describe('The rotation allowlist across every controller', () => {
  it('holds exactly GET /auth/me and POST /auth/change-password', async () => {
    const src = join(import.meta.dirname, '../src')
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.controller.ts'),
    )
    expect(files.length).toBeGreaterThan(10)

    const allowed: string[] = []
    for (const file of files) {
      const module = (await import(pathToFileURL(join(src, file)).href)) as Record<string, unknown>
      for (const exported of Object.values(module)) {
        if (
          typeof exported !== 'function' ||
          Reflect.getMetadata(PATH_METADATA, exported) === undefined
        ) {
          continue
        }
        if (Reflect.getMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY, exported)) {
          allowed.push(`${exported.name} (whole controller)`)
        }
        for (const name of Object.getOwnPropertyNames(exported.prototype)) {
          const handler = exported.prototype[name]
          if (
            typeof handler === 'function' &&
            Reflect.getMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY, handler)
          ) {
            allowed.push(`${exported.name}.${name}`)
          }
        }
      }
    }

    expect(allowed.sort()).toEqual([
      'AuthenticationController.changePassword',
      'AuthenticationController.me',
    ])
    // Importing every controller pulls in the whole host; the first cold transform is slow.
  }, 120_000)
})
