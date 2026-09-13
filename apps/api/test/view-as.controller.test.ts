// D7's HTTP layer. Two things are worth pinning here and the Application layer's own suite cannot
// pin either: how the three routes are wired, and that the controller does not narrow the
// contract's deliberately-indistinguishable 403.
//
// The 403 test goes through `ProblemDetailsFilter` rather than asserting on the thrown error,
// because "the same status and the same message" is a statement about the RESPONSE. A future
// change that gave one refusal its own error class would still throw three `ForbiddenError`s'
// worth of text and would still fail here, which is the point.

import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  ImpersonationOrganizationSummary,
  ImpersonationSessionRepository,
  ImpersonationUserSummary,
  ImpersonationUsersPort,
} from '@collega/application/impersonation'
import { ViewAsService } from '@collega/application/impersonation'
import { Role, UserStatus } from '@collega/domain/enums'
import type { ImpersonationSession } from '@collega/domain/impersonation'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { RolesGuard } from '../src/auth/roles.guard.js'
import { ProblemDetailsFilter } from '../src/common/errors/problem-details.filter.js'
import { ViewAsController } from '../src/view-as/view-as.controller.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ADMIN_ORG = '11111111-1111-1111-1111-111111111111'
const OTHER_ORG = '22222222-2222-2222-2222-222222222222'
const ORG_ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function user(
  id: string,
  role: Role,
  organizationId: string | null,
  status = UserStatus.Active,
): ImpersonationUserSummary {
  return {
    id,
    organizationId,
    firstName: 'Test',
    lastName: 'User',
    email: `${id}@example.test`,
    role,
    status,
  }
}

const ORGANIZATIONS: Record<string, ImpersonationOrganizationSummary> = {
  [ADMIN_ORG]: { id: ADMIN_ORG, title: 'Admin Org', isArchived: false },
  [OTHER_ORG]: { id: OTHER_ORG, title: 'Other Org', isArchived: false },
}

/** An Org Admin acting as themselves, which is the caller every refusal case below shares. */
const CURRENT_USER: CurrentUserContext = {
  isAuthenticated: true,
  userId: ORG_ADMIN,
  organizationId: ADMIN_ORG,
  role: Role.OrgAdmin,
  isImpersonating: false,
  realUserId: ORG_ADMIN,
}

function controllerFor(directory: readonly ImpersonationUserSummary[]): ViewAsController {
  const byId = new Map(directory.map((u) => [u.id, u]))

  const sessions: ImpersonationSessionRepository = {
    getOpenForRealUser: async () => null,
    add: async (_session: ImpersonationSession) => {},
    update: async (_session: ImpersonationSession) => {},
  }
  const users: ImpersonationUsersPort = {
    getById: async (id) => byId.get(id) ?? null,
    searchForImpersonation: async () => [],
  }
  const organizations = { getById: async (id: string) => ORGANIZATIONS[id] ?? null }
  const unitOfWork: UnitOfWork = { saveChanges: async () => {} }
  const auditEvents: AuditEventWriter = { write: async () => {} }
  const clock: Clock = { now: () => new Date('2026-09-13T12:00:00.000Z') }

  return new ViewAsController(
    new ViewAsService(sessions, users, organizations, unitOfWork, auditEvents, CURRENT_USER, clock),
  )
}

/** What `ProblemDetailsFilter` actually writes, captured without an HTTP server. */
type Rendered = { status: number; headers: Record<string, string>; body: unknown }

function render(exception: unknown, url: string): Rendered {
  const captured: Rendered = { status: 0, headers: {}, body: undefined }
  const response = {
    status(code: number) {
      captured.status = code
      return this
    },
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value
      return this
    },
    send(payload: string | Buffer) {
      captured.body = JSON.parse(payload.toString())
      return this
    },
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, originalUrl: url }),
    }),
    // Only switchToHttp is reached; the rest of ArgumentsHost is never touched by this filter.
  } as never

  new ProblemDetailsFilter().catch(exception, host)
  return captured
}

async function refusalBody(directory: readonly ImpersonationUserSummary[], targetUserId: string) {
  const controller = controllerFor(directory)
  const error = await controller.start({ targetUserId }).then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()

  const rendered = render(error, '/api/v1/auth/view-as')
  // `traceId` is a fresh uuid per response by design, so it is the one field that must differ.
  const { traceId, ...body } = rendered.body as Record<string, unknown>
  expect(traceId).toEqual(expect.any(String))
  return { status: rendered.status, headers: rendered.headers, body }
}

describe('ViewAsController routing', () => {
  it('roots every route at auth/view-as', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ViewAsController)).toBe('auth/view-as')
    expect(Reflect.getMetadata(PATH_METADATA, ViewAsController.prototype.start)).toBe('/')
    expect(Reflect.getMetadata(PATH_METADATA, ViewAsController.prototype.end)).toBe('/')
    expect(Reflect.getMetadata(PATH_METADATA, ViewAsController.prototype.candidates)).toBe(
      'candidates',
    )
  })

  it('answers POST 200 and DELETE 204, not Nest defaults of 201 and 200', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, ViewAsController.prototype.start)).toBe(
      RequestMethod.POST,
    )
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, ViewAsController.prototype.start)).toBe(200)

    expect(Reflect.getMetadata(METHOD_METADATA, ViewAsController.prototype.end)).toBe(
      RequestMethod.DELETE,
    )
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, ViewAsController.prototype.end)).toBe(204)

    expect(Reflect.getMetadata(METHOD_METADATA, ViewAsController.prototype.candidates)).toBe(
      RequestMethod.GET,
    )
  })

  it('guards with AuthGuard alone - the matrix reads the REAL role, which RolesGuard cannot', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ViewAsController) as readonly unknown[]
    expect(guards).toEqual([AuthGuard])
    expect(guards).not.toContain(RolesGuard)
  })
})

describe('POST /auth/view-as refusals', () => {
  it('rejects a missing targetUserId with the recorded model-binding message', async () => {
    const controller = controllerFor([user(ORG_ADMIN, Role.OrgAdmin, ADMIN_ORG)])
    const error = await controller.start({}).then(
      () => null,
      (thrown: unknown) => thrown,
    )

    const rendered = render(error, '/api/v1/auth/view-as')
    expect(rendered.status).toBe(400)
    expect((rendered.body as { errors: unknown }).errors).toEqual({
      targetUserId: ['Target User Id is required.'],
    })
  })

  it('renders the out-of-organization, Site Admin and Inactive refusals identically', async () => {
    const caller = user(ORG_ADMIN, Role.OrgAdmin, ADMIN_ORG)
    const outsideOrganization = user('b0000000-0000-0000-0000-000000000001', Role.User, OTHER_ORG)
    const siteAdmin = user('b0000000-0000-0000-0000-000000000002', Role.SiteAdmin, null)
    const inactive = user(
      'b0000000-0000-0000-0000-000000000003',
      Role.User,
      ADMIN_ORG,
      UserStatus.Inactive,
    )
    const directory = [caller, outsideOrganization, siteAdmin, inactive]

    const refusals = [
      await refusalBody(directory, outsideOrganization.id),
      await refusalBody(directory, siteAdmin.id),
      await refusalBody(directory, inactive.id),
    ]

    for (const refusal of refusals) {
      expect(refusal.status).toBe(403)
      // Byte for byte, not merely "all 403": a helpful, specific message here would disclose
      // whether the user exists and what role they hold, which is the whole point of the rule.
      expect(refusal).toEqual(refusals[0])
    }

    expect(refusals[0]?.body).toMatchObject({
      detail: 'You are not allowed to view as that user.',
      title: 'Forbidden',
      type: 'https://collega.dev/problems/forbidden',
    })
  })

  it('answers 404 for an id that names nobody, which the contract does distinguish', async () => {
    const rendered = await refusalBody(
      [user(ORG_ADMIN, Role.OrgAdmin, ADMIN_ORG)],
      'b0000000-0000-0000-0000-00000000000f',
    )
    expect(rendered.status).toBe(404)
  })
})
