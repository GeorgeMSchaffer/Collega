// Shared test doubles for the application layer.
//
// Every service in this package takes the same four collaborators - CurrentUserContext, Clock,
// UnitOfWork, AuditEventWriter - so these live here rather than being restated in each of the
// fifteen suites below. Feature-specific ports stay in their own suite: they differ per feature
// and a shared fake would have to grow a branch for each.

import { Role } from '@collega/domain/enums'
import type {
  AuditEventInput,
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '../../src/common/index.js'

export const ORG_A = 'org-a'
export const ORG_B = 'org-b'

export const NOW = new Date('2026-09-08T12:00:00.000Z')

export function fixedClock(now: Date = NOW): Clock {
  return { now: () => now }
}

export type RecordingAudit = AuditEventWriter & { readonly events: AuditEventInput[] }

export function recordingAudit(): RecordingAudit {
  const events: AuditEventInput[] = []
  return {
    events,
    async write(event) {
      events.push(event)
    },
  }
}

export type CountingUnitOfWork = UnitOfWork & { saves: number }

export function countingUnitOfWork(): CountingUnitOfWork {
  const uow = {
    saves: 0,
    async saveChanges() {
      uow.saves++
    },
  }
  return uow
}

/** A unit of work that must never be reached - any commit fails the test that used it. */
export const forbiddenUnitOfWork: UnitOfWork = {
  async saveChanges() {
    throw new Error('saveChanges was called on a path that must not persist anything.')
  },
}

function context(overrides: Partial<CurrentUserContext>): CurrentUserContext {
  const userId = overrides.userId ?? 'user-1'
  return {
    isAuthenticated: true,
    userId,
    organizationId: ORG_A,
    role: Role.User,
    isImpersonating: false,
    realUserId: userId,
    ...overrides,
  }
}

/** A Site Admin acting as themselves: no organization, by domain invariant. */
export function siteAdmin(userId = 'site-admin-1'): CurrentUserContext {
  return context({ userId, role: Role.SiteAdmin, organizationId: null })
}

export function orgAdmin(organizationId = ORG_A, userId = 'org-admin-1'): CurrentUserContext {
  return context({ userId, role: Role.OrgAdmin, organizationId })
}

export function member(organizationId = ORG_A, userId = 'user-1'): CurrentUserContext {
  return context({ userId, role: Role.User, organizationId })
}

export function readOnly(organizationId = ORG_A, userId = 'readonly-1'): CurrentUserContext {
  return context({ userId, role: Role.ReadOnly, organizationId })
}

export const anonymous: CurrentUserContext = {
  isAuthenticated: false,
  userId: null,
  organizationId: null,
  role: null,
  isImpersonating: false,
  realUserId: null,
}

/**
 * A live View As session. `role`/`organizationId`/`userId` are the TARGET's - that is the property
 * every authorization check in this package relies on (view-as rule 4) - while `realUserId` stays
 * the administrator's, which is what rule 14 audit attribution reads.
 */
export function impersonating(options: {
  targetUserId: string
  targetRole: Role
  targetOrganizationId: string
  realUserId?: string
}): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId: options.targetUserId,
    organizationId: options.targetOrganizationId,
    role: options.targetRole,
    isImpersonating: true,
    realUserId: options.realUserId ?? 'site-admin-1',
  }
}

/** The four roles, for `it.each` matrices. */
export const ALL_ROLES = [Role.SiteAdmin, Role.OrgAdmin, Role.User, Role.ReadOnly] as const
