// Status configuration (SPEC/20-feature-boards-and-statuses.md "Status Rules").
//
// The status catalog is readable by every member because every board render needs it, and
// writable only by an in-scope Org Admin. The two floors - two active statuses per organization,
// and no deletion while a board still references one - are what stop an admin rendering their own
// boards unusable.

import { Role } from '@collega/domain/enums'
import { createStatus, type Status, softDeleteStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import type { BoardRepository } from '../../src/boards/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import type { CreateStatusCommand, UpdateStatusCommand } from '../../src/statuses/models.js'
import type { OrganizationExistenceLookup, StatusRepository } from '../../src/statuses/ports.js'
import { StatusService } from '../../src/statuses/status-service.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
  member,
} from '../support/fixtures.js'

function status(
  id: string,
  organizationId = ORG_A,
  sortOrder = 10,
  name = `Status ${id}`,
): Status {
  return createStatus({
    id,
    organizationId,
    name,
    color: '#123456',
    sortOrder,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

const CREATE: CreateStatusCommand = { name: 'Triage', color: null, sortOrder: null }
const UPDATE: UpdateStatusCommand = { name: 'Renamed', color: null, sortOrder: null }

function harness(options: {
  currentUser: CurrentUserContext
  statuses?: readonly Status[]
  referencedStatusIds?: readonly string[]
  organizations?: readonly string[]
}) {
  const all = [...(options.statuses ?? [status('s1'), status('s2', ORG_A, 20), status('s3', ORG_A, 30)])]
  const referenced = new Set(options.referencedStatusIds ?? [])
  const existingOrgs = new Set(options.organizations ?? [ORG_A, ORG_B])
  const added: Status[] = []
  const saved: Status[] = []

  const statuses: StatusRepository = {
    async add(s) {
      added.push(s)
    },
    async addMany() {},
    async getById(id) {
      return all.find((s) => s.id === id) ?? null
    },
    async listActiveByOrganization(organizationId) {
      return all.filter((s) => s.organizationId === organizationId && !s.isDeleted)
    },
    async listByOrganization(organizationId, includeDeleted) {
      return all.filter(
        (s) => s.organizationId === organizationId && (includeDeleted || !s.isDeleted),
      )
    },
    async countActiveByOrganization(organizationId) {
      return all.filter((s) => s.organizationId === organizationId && !s.isDeleted).length
    },
    async save(s) {
      saved.push(s)
    },
  }

  const boards = {
    async isStatusReferenced(statusId: string) {
      return referenced.has(statusId)
    },
  } as BoardRepository

  const organizations: OrganizationExistenceLookup = {
    async existsById(id) {
      return existingOrgs.has(id)
    },
  }

  const audit = recordingAudit()

  return {
    service: new StatusService(
      statuses,
      boards,
      organizations,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    added,
    saved,
    audit,
  }
}

describe('StatusService read scope', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('lets %s read their own catalog', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.list(ORG_A, false)).resolves.toHaveLength(3)
  })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s another organization’s catalog', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.list(ORG_B, false)).rejects.toThrow(NotFoundError)
  })

  it('lets a Site Admin read any catalog', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      statuses: [status('b1', ORG_B), status('b2', ORG_B, 20)],
    })

    await expect(service.list(ORG_B, false)).resolves.toHaveLength(2)
  })

  it('hides soft-deleted statuses unless asked for them (rule #8)', async () => {
    const deleted = softDeleteStatus(status('s3', ORG_A, 30), NOW, 'seed')
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [status('s1'), status('s2', ORG_A, 20), deleted],
    })

    await expect(service.list(ORG_A, false)).resolves.toHaveLength(2)
    await expect(service.list(ORG_A, true)).resolves.toHaveLength(3)
  })

  it('orders by sortOrder then name, never by id', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [
        status('zzz', ORG_A, 10, 'Alpha'),
        status('aaa', ORG_A, 10, 'Beta'),
        status('mmm', ORG_A, 5, 'Gamma'),
      ],
    })

    const result = await service.list(ORG_A, false)

    expect(result.map((s) => s.statusId)).toEqual(['mmm', 'zzz', 'aaa'])
  })
})

describe('StatusService admin scope', () => {
  it('refuses a direct Site Admin every status mutation (rule 25)', async () => {
    const { service, added, saved } = harness({ currentUser: siteAdmin() })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('s1', UPDATE)).rejects.toThrow(ForbiddenError)
    await expect(service.reorder(ORG_A, ['s1', 's2', 's3'])).rejects.toThrow(ForbiddenError)
    await expect(service.delete('s1')).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('lets that Site Admin create once acting as an Org Admin through View As', async () => {
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: 'target-admin',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.create(ORG_A, CREATE)

    expect(added).toHaveLength(1)
  })

  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s status management', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.delete('s1')).rejects.toThrow(ForbiddenError)
  })

  it('refuses an Org Admin managing another organization’s status, as not-found', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_B),
      statuses: [status('s1')],
    })

    await expect(service.update('s1', UPDATE)).rejects.toBeInstanceOf(NotFoundError)
    expect(saved).toHaveLength(0)
  })

  it('refuses an Org Admin reordering another organization’s catalog', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.reorder(ORG_B, ['s1'])).rejects.toThrow(NotFoundError)
    expect(saved).toHaveLength(0)
  })
})

describe('StatusService deletion floors', () => {
  it('refuses deletion that would leave fewer than two active statuses (rule #7)', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [status('s1'), status('s2', ORG_A, 20)],
    })

    await expect(service.delete('s1')).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('refuses deletion of a status still used as a swimlane (rule #6)', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      referencedStatusIds: ['s1'],
    })

    await expect(service.delete('s1')).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('soft-deletes when both floors are clear', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.delete('s1')

    expect(saved[0]?.isDeleted).toBe(true)
  })

  it('is idempotent on an already-deleted status', async () => {
    const deleted = softDeleteStatus(status('s1'), NOW, 'seed')
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [deleted, status('s2', ORG_A, 20), status('s3', ORG_A, 30)],
    })

    await expect(service.delete('s1')).resolves.toBeUndefined()
    expect(saved).toHaveLength(0)
  })

  it('treats a soft-deleted status as gone on the update path', async () => {
    const deleted = softDeleteStatus(status('s1'), NOW, 'seed')
    const { service } = harness({ currentUser: orgAdmin(ORG_A), statuses: [deleted] })

    await expect(service.update('s1', UPDATE)).rejects.toThrow(NotFoundError)
  })
})

describe('StatusService.reorder', () => {
  it('rejects a list that does not cover every active status exactly once', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.reorder(ORG_A, ['s1', 's2'])).rejects.toThrow(ValidationError)
    await expect(service.reorder(ORG_A, ['s1', 's1', 's2'])).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('renumbers every status in the requested order', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.reorder(ORG_A, ['s3', 's1', 's2'])

    expect(saved.map((s) => [s.id, s.sortOrder])).toEqual([
      ['s3', 10],
      ['s1', 20],
      ['s2', 30],
    ])
  })
})
