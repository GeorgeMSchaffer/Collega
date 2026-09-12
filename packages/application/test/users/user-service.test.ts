// User administration (SPEC/20-feature-organizations-and-users.md "User Rules").
//
// Like OrganizationService this is the bootstrap exception (view-as rule 26) - a direct Site Admin
// administers users without View As. What it must still do is keep an Org Admin inside their own
// organization on every path, including the bulk CSV import, which is the path a per-endpoint
// check is most likely to miss.

import { Role, UserStatus } from '@collega/domain/enums'
import { createOrganizationUser, type User } from '@collega/domain/users'
import { describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../../src/auth/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../src/common/index.js'
import type { CreateUserCommand, UpdateUserCommand, UserListQuery } from '../../src/users/models.js'
import type { UserListFilter, UserRepository } from '../../src/users/ports.js'
import { UserService } from '../../src/users/user-service.js'
import {
  countingUnitOfWork,
  fixedClock,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const VALID_PASSWORD = 'Abc123!xyz'

function user(overrides: Partial<User> = {}): User {
  const base = createOrganizationUser(
    {
      id: 'user-a',
      organizationId: ORG_A,
      firstName: 'Ann',
      lastName: 'Author',
      email: 'ann@acme.test',
      passwordHash: 'hash',
      role: Role.User,
      status: UserStatus.Active,
      mustChangePassword: false,
    },
    NOW,
    'seed',
  )
  const merged = { ...base, ...overrides }
  // `normalizedEmail` is derived, so an `email` override has to carry it or the store fake's
  // uniqueness lookup silently stops matching.
  return { ...merged, normalizedEmail: merged.email.trim().toLowerCase() }
}

const CREATE: CreateUserCommand = {
  firstName: 'New',
  lastName: 'Person',
  email: 'new@acme.test',
  role: Role.User,
  initialPassword: VALID_PASSWORD,
  status: null,
}

const LIST_QUERY: UserListQuery = {
  page: null,
  pageSize: null,
  search: null,
  role: null,
  status: null,
  sortBy: null,
  sortDirection: null,
}

function harness(options: {
  currentUser: CurrentUserContext
  users?: readonly User[]
  activeOrgAdminCount?: number
}) {
  const byId = new Map((options.users ?? [user()]).map((u) => [u.id, u]))
  const added: User[] = []
  const updated: User[] = []
  const filters: UserListFilter[] = []

  const users: UserRepository = {
    async getById(id) {
      return byId.get(id) ?? null
    },
    async getByNormalizedEmail(email) {
      return [...byId.values()].find((u) => u.normalizedEmail === email) ?? null
    },
    async existsByNormalizedEmail(email) {
      return [...byId.values()].some((u) => u.normalizedEmail === email)
    },
    async anySiteAdmin() {
      return true
    },
    async listByOrganization(filter) {
      filters.push(filter)
      const items = [...byId.values()].filter(
        (u) =>
          u.organizationId === filter.organizationId &&
          (filter.status === null || u.status === filter.status),
      )
      return {
        items,
        page: filter.page.page,
        pageSize: filter.page.pageSize,
        totalCount: items.length,
        sortBy: filter.sortBy,
        sortDirection: filter.sortDirection ?? 'asc',
      }
    },
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const found = byId.get(id)
        return found ? [found] : []
      })
    },
    async searchForImpersonation() {
      return []
    },
    async countActiveOrgAdmins() {
      return options.activeOrgAdminCount ?? 0
    },
    async add(u) {
      added.push(u)
      byId.set(u.id, u)
    },
    async update(u) {
      updated.push(u)
    },
  }

  const passwordHasher: PasswordHasher = {
    hash: (plain) => `hashed:${plain}`,
    verify: (plain, hash) => hash === `hashed:${plain}`,
  }

  const audit = recordingAudit()

  return {
    service: new UserService(
      users,
      passwordHasher,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    repository: users,
    added,
    updated,
    filters,
    audit,
  }
}

describe('UserService cross-organization isolation', () => {
  it('reports another organization as not-found to an Org Admin, never forbidden', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.listByOrganization(ORG_B, LIST_QUERY)).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('refuses an Org Admin creating a user in another organization', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.create(ORG_B, CREATE)).rejects.toThrow(NotFoundError)
    expect(added).toHaveLength(0)
  })

  it('refuses the CSV import path too - bulk create is still create', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.import(ORG_B, [
        { rowNumber: 1, firstName: 'A', lastName: 'B', email: 'ab@beta.test', role: Role.User },
      ]),
    ).rejects.toThrow(NotFoundError)
    expect(added).toHaveLength(0)
  })

  it('refuses an Org Admin reading a user who belongs to another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [user({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(service.getById('outsider')).rejects.toThrow(NotFoundError)
  })

  it('refuses an Org Admin updating a user who belongs to another organization', async () => {
    const { service, updated } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [user({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(service.update('outsider', updateFrom(user({ id: 'outsider' })))).rejects.toThrow(
      NotFoundError,
    )
    expect(updated).toHaveLength(0)
  })

  it('scopes the store query to the requested organization on every page of the member list', async () => {
    const { service, filters } = harness({
      currentUser: member(ORG_A),
      users: [user(), user({ id: 'outsider', organizationId: ORG_B, email: 'o@beta.test' })],
    })

    const members = await service.listAssignableMembers(ORG_A)

    expect(filters.every((f) => f.organizationId === ORG_A)).toBe(true)
    expect(members.map((m) => m.userId)).toEqual(['user-a'])
  })

  it('refuses a member of another organization the assignable-member list', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    await expect(service.listAssignableMembers(ORG_B)).rejects.toThrow(NotFoundError)
  })

  it('lets a Site Admin administer users in any organization', async () => {
    const { service, added } = harness({ currentUser: siteAdmin() })

    await service.create(ORG_B, CREATE)

    expect(added).toHaveLength(1)
    expect(added[0]?.organizationId).toBe(ORG_B)
  })
})

describe('UserService role matrix', () => {
  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s user administration in their own organization', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.listByOrganization(ORG_A, LIST_QUERY)).rejects.toThrow(ForbiddenError)
    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.getById('user-a')).rejects.toThrow(ForbiddenError)
  })

  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])(
    'lets %s read the assignable-member list of their own organization',
    async (_l, currentUser) => {
      const { service } = harness({ currentUser })

      await expect(service.listAssignableMembers(ORG_A)).resolves.toHaveLength(1)
    },
  )

  it('refuses Site Admin as an assignable role on create, at the service rather than the domain', async () => {
    // The domain also refuses it, so a ValidationError alone proves nothing about which layer
    // rejected it. The service's message names the three assignable roles; the domain's does not.
    const { service, added } = harness({ currentUser: siteAdmin() })

    const error = await service
      .create(ORG_A, { ...CREATE, role: Role.SiteAdmin })
      .catch((e: ValidationError) => e)

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).failures.role?.[0]).toContain('Role must be one of')
    expect(added).toHaveLength(0)
  })

  it('refuses a role string that is not a role at all', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(service.create(ORG_A, { ...CREATE, role: 'Wizard' })).rejects.toThrow(
      ValidationError,
    )
  })

  it('forces a password change on an admin-issued initial credential', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.create(ORG_A, CREATE)

    expect(added[0]?.mustChangePassword).toBe(true)
  })

  it('rejects a duplicate email globally, not just within the organization', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [user({ id: 'elsewhere', organizationId: ORG_B, email: 'new@acme.test' })],
    })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ConflictError)
  })
})

describe('UserService.update last-Org-Admin safeguard', () => {
  const lastAdmin = user({ id: 'admin-1', role: Role.OrgAdmin, email: 'admin@acme.test' })

  it('stops the last Org Admin removing their own admin role', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A, 'admin-1'),
      users: [lastAdmin],
      activeOrgAdminCount: 0,
    })

    await expect(
      service.update('admin-1', { ...updateFrom(lastAdmin), role: Role.User }),
    ).rejects.toThrow(ValidationError)
  })

  it('stops the last Org Admin deactivating themselves', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A, 'admin-1'),
      users: [lastAdmin],
      activeOrgAdminCount: 0,
    })

    await expect(
      service.update('admin-1', { ...updateFrom(lastAdmin), status: UserStatus.Inactive }),
    ).rejects.toThrow(ValidationError)
  })

  it('allows the step down when another active Org Admin remains', async () => {
    const { service, updated } = harness({
      currentUser: orgAdmin(ORG_A, 'admin-1'),
      users: [lastAdmin],
      activeOrgAdminCount: 1,
    })

    await service.update('admin-1', { ...updateFrom(lastAdmin), role: Role.User })

    expect(updated[0]?.role).toBe(Role.User)
  })

  it('does not apply to a Site Admin demoting the last Org Admin - the guard is scoped to self-action', async () => {
    const { service, updated } = harness({
      currentUser: siteAdmin(),
      users: [lastAdmin],
      activeOrgAdminCount: 0,
    })

    await service.update('admin-1', { ...updateFrom(lastAdmin), role: Role.User })

    expect(updated[0]?.role).toBe(Role.User)
  })
})

describe('UserService.import', () => {
  it('reports a rejected row without stopping the rest, and creates the valid ones', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    const result = await service.import(ORG_A, [
      { rowNumber: 1, firstName: 'Valid', lastName: 'Row', email: 'v1@acme.test', role: Role.User },
      { rowNumber: 2, firstName: '', lastName: '', email: '', role: Role.User },
      {
        rowNumber: 3,
        firstName: 'Also',
        lastName: 'Valid',
        email: 'v3@acme.test',
        role: Role.User,
      },
    ])

    expect(result.createdCount).toBe(2)
    expect(result.rejectedCount).toBe(1)
    expect(result.rows[1]?.outcome).toBe('rejected')
    expect(added.map((u) => u.email)).toEqual(['v1@acme.test', 'v3@acme.test'])
  })

  it('rejects a duplicate email inside the file rather than creating it twice', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    const result = await service.import(ORG_A, [
      { rowNumber: 1, firstName: 'A', lastName: 'One', email: 'dupe@acme.test', role: Role.User },
      { rowNumber: 2, firstName: 'B', lastName: 'Two', email: 'dupe@acme.test', role: Role.User },
    ])

    expect(result.createdCount).toBe(1)
    expect(result.rejectedCount).toBe(1)
    expect(added).toHaveLength(1)
  })

  it('rejects a Site Admin role on an imported row', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    const result = await service.import(ORG_A, [
      { rowNumber: 1, firstName: 'A', lastName: 'One', email: 'a@acme.test', role: Role.SiteAdmin },
    ])

    expect(result.createdCount).toBe(0)
    expect(result.rows[0]?.outcome).toBe('rejected')
  })

  it('creates every imported user in the organization the caller named', async () => {
    const { service, added } = harness({ currentUser: siteAdmin() })

    await service.import(ORG_B, [
      { rowNumber: 1, firstName: 'A', lastName: 'One', email: 'a@beta.test', role: Role.User },
    ])

    expect(added[0]?.organizationId).toBe(ORG_B)
  })

  it('keeps the temporary password out of the audit event', async () => {
    const { service, audit } = harness({ currentUser: orgAdmin(ORG_A) })

    const result = await service.import(ORG_A, [
      { rowNumber: 1, firstName: 'A', lastName: 'One', email: 'a@acme.test', role: Role.User },
    ])

    const temporaryPassword = result.rows[0]?.temporaryPassword
    expect(temporaryPassword).toBeTruthy()
    const serialized = JSON.stringify(audit.events)
    expect(serialized).not.toContain(temporaryPassword as string)
  })

  it('lets a genuine defect propagate rather than reporting it as a rejected row', async () => {
    // The per-row catch is for ApplicationError only. A TypeError from the store is a bug, and
    // reporting it as "this row was rejected" would hide an outage behind a plausible CSV error.
    const broken = harness({ currentUser: orgAdmin(ORG_A) })
    const service = new UserService(
      {
        ...broken.repository,
        async existsByNormalizedEmail() {
          throw new TypeError('store is broken')
        },
      },
      { hash: (plain) => `hashed:${plain}`, verify: () => true },
      countingUnitOfWork(),
      recordingAudit(),
      orgAdmin(ORG_A),
      fixedClock(),
    )

    await expect(
      service.import(ORG_A, [
        { rowNumber: 1, firstName: 'A', lastName: 'One', email: 'a@acme.test', role: Role.User },
      ]),
    ).rejects.toThrow(TypeError)
  })
})

function updateFrom(existing: User): UpdateUserCommand {
  return {
    firstName: existing.firstName,
    lastName: existing.lastName,
    email: existing.email,
    role: existing.role,
    status: existing.status,
  }
}
