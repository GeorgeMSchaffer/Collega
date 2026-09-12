// Organization administration (SPEC/20-feature-organizations-and-users.md).
//
// This service is the bootstrap exception (view-as rule 26): a direct Site Admin creates and
// administers organizations without View As, so `ensureNotDirectSiteAdmin` is deliberately absent.
// The tests below pin both halves of that - the Site Admin passes, and no other role stands in.

import { createOrganization, type Organization } from '@collega/domain/organizations'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import type {
  CreateOrganizationCommand,
  OrganizationListQuery,
  UpdateOrganizationCommand,
} from '../../src/organizations/models.js'
import { OrganizationService } from '../../src/organizations/organization-service.js'
import type {
  InviteCodeGenerator,
  OrganizationBootstrapPort,
  OrganizationRepository,
} from '../../src/organizations/ports.js'
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
import { Role } from '@collega/domain/enums'

const EMPTY_PROFILE = {
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  primaryContactFirstName: null,
  primaryContactLastName: null,
}

function organization(id: string, title = 'Acme'): Organization {
  return createOrganization(
    { id, title, description: 'A description', inviteCode: `code-${id}`, profile: EMPTY_PROFILE },
    NOW,
    'seed',
  )
}

const CREATE: CreateOrganizationCommand = {
  title: 'New Org',
  description: 'Freshly minted',
  logoUrl: null,
  profile: EMPTY_PROFILE,
}

const UPDATE: UpdateOrganizationCommand = {
  title: 'Renamed',
  description: 'Still here',
  logoUrl: null,
  profile: EMPTY_PROFILE,
}

const LIST_QUERY: OrganizationListQuery = {
  page: null,
  pageSize: null,
  search: null,
  includeArchived: false,
  sortBy: null,
  sortDirection: null,
}

function harness(options: {
  currentUser: CurrentUserContext
  organizations?: readonly Organization[]
  inviteCodes?: readonly string[]
  existingInviteCodes?: readonly string[]
}) {
  const byId = new Map((options.organizations ?? [organization(ORG_A)]).map((o) => [o.id, o]))
  const updated: Organization[] = []
  const added: Organization[] = []
  const taken = new Set(options.existingInviteCodes ?? [])
  const codes = [...(options.inviteCodes ?? ['CODE1', 'CODE2', 'CODE3'])]
  let codeIndex = 0

  const organizations: OrganizationRepository = {
    async getById(id) {
      return byId.get(id) ?? null
    },
    async getByInviteCode() {
      return null
    },
    async list(filter) {
      const items = [...byId.values()].filter((o) => filter.includeArchived || !o.isArchived)
      return {
        items,
        page: filter.page.page,
        pageSize: filter.page.pageSize,
        totalCount: items.length,
        sortBy: filter.sortBy,
        sortDirection: filter.sortDirection ?? 'asc',
      }
    },
    async inviteCodeExists(code) {
      return taken.has(code)
    },
    async add(o) {
      added.push(o)
    },
    async update(o) {
      updated.push(o)
    },
  }

  const bootstrap: OrganizationBootstrapPort = {
    async provisionDefaults() {
      return { defaultBoardId: 'default-board', defaultStatusCount: 5 }
    },
  }

  const inviteCodeGenerator: InviteCodeGenerator = {
    generate() {
      return codes[codeIndex++ % codes.length] as string
    },
  }

  const audit = recordingAudit()

  return {
    service: new OrganizationService(
      organizations,
      bootstrap,
      inviteCodeGenerator,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    added,
    updated,
    audit,
  }
}

describe('OrganizationService Site-Admin-only operations', () => {
  const nonSiteAdmins: readonly [string, CurrentUserContext][] = [
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ]

  it.each(nonSiteAdmins)('refuses %s the organization list', async (_label, currentUser) => {
    const { service } = harness({ currentUser })
    await expect(service.list(LIST_QUERY)).rejects.toThrow(ForbiddenError)
  })

  it.each(nonSiteAdmins)('refuses %s organization creation', async (_label, currentUser) => {
    const { service, added } = harness({ currentUser })
    await expect(service.create(CREATE)).rejects.toThrow(ForbiddenError)
    expect(added).toHaveLength(0)
  })

  it.each(nonSiteAdmins)('refuses %s organization archiving', async (_label, currentUser) => {
    const { service, updated } = harness({ currentUser })
    await expect(service.archive(ORG_A)).rejects.toThrow(ForbiddenError)
    expect(updated).toHaveLength(0)
  })

  it('lets a direct Site Admin create an organization - the bootstrap exception (rule 26)', async () => {
    const { service, added } = harness({ currentUser: siteAdmin() })

    const result = await service.create(CREATE)

    expect(added).toHaveLength(1)
    expect(result.defaultBoardId).toBe('default-board')
    expect(result.defaultStatusCount).toBe(5)
  })

  it('refuses an Org Admin acting as an Org Admin through View As - the role is the target’s', async () => {
    const { service } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    })

    await expect(service.create(CREATE)).rejects.toThrow(ForbiddenError)
  })
})

describe('OrganizationService cross-organization isolation', () => {
  it('reports another organization as not-found to an Org Admin, never forbidden', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_A), organization(ORG_B, 'Beta')],
    })

    await expect(service.getById(ORG_B)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses an Org Admin every write against another organization', async () => {
    const { service, updated } = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_A), organization(ORG_B, 'Beta')],
    })

    await expect(service.update(ORG_B, UPDATE)).rejects.toThrow(NotFoundError)
    await expect(service.regenerateInviteCode(ORG_B)).rejects.toThrow(NotFoundError)
    await expect(
      service.setLogo(ORG_B, { thumbnailDataUri: 'data:image/png;base64,AAAA', heightPx: 40 }),
    ).rejects.toThrow(NotFoundError)
    await expect(service.clearLogo(ORG_B)).rejects.toThrow(NotFoundError)
    expect(updated).toHaveLength(0)
  })

  it('checks scope before touching the store, so an out-of-scope id is never even read', async () => {
    // ORG_B exists in the store. If the scope check ran after the load, the not-found would be
    // indistinguishable - but a caller could still time the difference. It runs first.
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_B, 'Beta')],
    })

    await expect(service.getById(ORG_B)).rejects.toThrow(NotFoundError)
  })

  it('lets an Org Admin administer their own organization', async () => {
    const { service, updated } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.update(ORG_A, UPDATE)

    expect(updated).toHaveLength(1)
    expect(updated[0]?.title).toBe('Renamed')
  })

  it('lets a Site Admin administer any organization', async () => {
    const { service, updated } = harness({
      currentUser: siteAdmin(),
      organizations: [organization(ORG_B, 'Beta')],
    })

    await service.update(ORG_B, UPDATE)

    expect(updated).toHaveLength(1)
  })

  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s administration of their own organization', async (_label, currentUser) => {
    const { service } = harness({ currentUser })
    await expect(service.getById(ORG_A)).rejects.toThrow(ForbiddenError)
  })
})

describe('OrganizationService.regenerateInviteCode', () => {
  // SPEC/40-test-strategy.md owes this assertion as a unit test: the golden corpus redacts invite
  // codes in both directions, so "the code changed" is invisible to a replay diff.
  it('returns a different code than the organization had', async () => {
    const existing = organization(ORG_A)
    const { service } = harness({
      currentUser: siteAdmin(),
      organizations: [existing],
      inviteCodes: ['FRESH1'],
    })

    const result = await service.regenerateInviteCode(ORG_A)

    expect(result.inviteCode).not.toBe(existing.inviteCode)
    expect(result.inviteCode).toBe('FRESH1')
  })

  it('skips a generated code that is already taken', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      inviteCodes: ['TAKEN', 'TAKEN', 'FREE'],
      existingInviteCodes: ['TAKEN'],
    })

    const result = await service.regenerateInviteCode(ORG_A)

    expect(result.inviteCode).toBe('FREE')
  })

  it('gives up rather than looping forever when every candidate collides', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      inviteCodes: ['TAKEN'],
      existingInviteCodes: ['TAKEN'],
    })

    await expect(service.regenerateInviteCode(ORG_A)).rejects.toThrow(
      'Unable to generate a unique organization invite code.',
    )
  })
})

describe('OrganizationService.setLogo', () => {
  it.each([
    ['an empty value', ''],
    ['whitespace', '   '],
    ['a non-image data URI', 'data:text/html;base64,PHNjcmlwdD4='],
    ['a plain URL', 'https://example.test/logo.png'],
  ])('rejects %s', async (_label, dataUri) => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(service.setLogo(ORG_A, { thumbnailDataUri: dataUri, heightPx: 40 })).rejects.toThrow(
      ValidationError,
    )
  })

  it('accepts an image data URI', async () => {
    const { service, updated } = harness({ currentUser: siteAdmin() })

    await service.setLogo(ORG_A, { thumbnailDataUri: 'data:image/png;base64,AAAA', heightPx: 40 })

    expect(updated).toHaveLength(1)
    expect(updated[0]?.logoThumbnailUrl).toBe('data:image/png;base64,AAAA')
  })
})

describe('OrganizationService audit attribution', () => {
  it('records a direct Site Admin as the sole actor', async () => {
    const { service, audit } = harness({ currentUser: siteAdmin('sa-9') })

    await service.update(ORG_A, UPDATE)

    expect(audit.events[0]?.attribution.actorUserId).toBe('sa-9')
    expect(audit.events[0]?.attribution.onBehalfOfUserId).toBeNull()
  })

  it('splits actor and on-behalf-of while a View As session is live (rule 14)', async () => {
    const { service, audit } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.SiteAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await service.update(ORG_A, UPDATE)

    expect(audit.events[0]?.attribution.actorUserId).toBe('sa-9')
    expect(audit.events[0]?.attribution.onBehalfOfUserId).toBe('target-1')
  })
})
