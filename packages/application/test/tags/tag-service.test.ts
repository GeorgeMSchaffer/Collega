// Settings → Tags and the tag catalog (SPEC/20-feature-ideas-and-engagement.md Tags rules 9-15,
// "Who administers tags"; SPEC/30-Contracts.md "Tag colour and management"). The repository is an
// in-memory double that computes usage from idea-tag links the way the grouped query does (live
// ideas only, both phases), and counts its reads so the catalog's query budget is checkable.

import { Role } from '@collega/domain/enums'
import { createTag, TAG_COLOR_PALETTE, type Tag } from '@collega/domain/tags'
import { describe, expect, it } from 'vitest'
import {
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  type RandomSource,
  UnauthorizedError,
  ValidationError,
} from '../../src/common/index.js'
import type { OrganizationExistenceLookup, TagRepository, TagUsage } from '../../src/tags/ports.js'
import { DUPLICATE_TAG_NAME_MESSAGE, TagService } from '../../src/tags/tag.service.js'
import {
  anonymous,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const CREATED = new Date('2026-09-01T09:00:00.000Z')

type Link = {
  readonly ideaId: string
  readonly tagId: string
  readonly boardId: string
  readonly boardName: string
  readonly isDeleted: boolean
}

type Calls = Record<
  | 'listByOrganization'
  | 'usageByTagIds'
  | 'getCreatorNames'
  | 'add'
  | 'save'
  | 'delete'
  | 'getById'
  | 'findByNormalizedName',
  number
>

function tag(id: string, name: string, overrides: Partial<Tag> = {}): Tag {
  return {
    ...createTag({
      id,
      organizationId: ORG_A,
      name,
      color: '#6B9BF2',
      nowUtc: CREATED,
      actorUserId: 'org-admin-1',
    }),
    ...overrides,
  }
}

function setup(options: {
  currentUser: CurrentUserContext
  tags?: readonly Tag[]
  links?: readonly Link[]
  random?: RandomSource
  /** The tag vanishes between the service's read and the repository's write. */
  deleteFails?: boolean
}) {
  const tagsById = new Map((options.tags ?? []).map((t) => [t.id, t]))
  let links = [...(options.links ?? [])]
  const calls: Calls = {
    listByOrganization: 0,
    usageByTagIds: 0,
    getCreatorNames: 0,
    add: 0,
    save: 0,
    delete: 0,
    getById: 0,
    findByNormalizedName: 0,
  }

  const repository: TagRepository = {
    async listByIds(ids) {
      return ids.flatMap((id) => tagsById.get(id) ?? [])
    },
    async getOrCreate() {
      throw new Error('Settings → Tags never creates inline')
    },
    async searchByPrefix() {
      return []
    },
    async listByOrganization(organizationId) {
      calls.listByOrganization++
      return [...tagsById.values()].filter((t) => t.organizationId === organizationId)
    },
    async getById(id) {
      calls.getById++
      return tagsById.get(id) ?? null
    },
    async findByNormalizedName(organizationId, normalizedName) {
      calls.findByNormalizedName++
      return (
        [...tagsById.values()].find(
          (t) => t.organizationId === organizationId && t.normalizedName === normalizedName,
        ) ?? null
      )
    },
    async usageByTagIds(ids) {
      calls.usageByTagIds++
      const usage = new Map<string, { ideaCount: number; boards: Map<string, string> }>()
      for (const link of links) {
        if (!ids.includes(link.tagId) || link.isDeleted) continue
        const entry = usage.get(link.tagId) ?? { ideaCount: 0, boards: new Map() }
        entry.ideaCount++
        entry.boards.set(link.boardId, link.boardName)
        usage.set(link.tagId, entry)
      }
      return new Map<string, TagUsage>(
        [...usage].map(([id, u]) => [
          id,
          {
            ideaCount: u.ideaCount,
            boards: [...u.boards].map(([boardId, name]) => ({ boardId, name })),
          },
        ]),
      )
    },
    async getCreatorNames(userIds) {
      calls.getCreatorNames++
      return new Map(
        userIds
          .filter((id) => id === 'org-admin-1')
          .map((id) => [id, { firstName: 'Olive', lastName: 'Admin' }]),
      )
    },
    async add(t) {
      calls.add++
      tagsById.set(t.id, t)
    },
    async save(t) {
      calls.save++
      tagsById.set(t.id, t)
    },
    async delete(id) {
      calls.delete++
      if (options.deleteFails) throw new NotFoundError('Tag not found.')
      links = links.filter((l) => l.tagId !== id)
      tagsById.delete(id)
    },
  }
  const organizations: OrganizationExistenceLookup = {
    existsById: async (id) => id === ORG_A || id === ORG_B,
  }
  const audit = recordingAudit()
  const service = new TagService(
    repository,
    organizations,
    audit,
    options.currentUser,
    fixedClock(),
    options.random ?? { nextInt: () => 3 },
  )
  return {
    service,
    audit,
    calls,
    tagsById,
    links: () => links,
  }
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection')
    },
    (error: unknown) => error,
  )
}

async function fieldErrors(promise: Promise<unknown>): Promise<Record<string, string[]>> {
  const error = await rejection(promise)
  expect(error).toBeInstanceOf(ValidationError)
  return (error as ValidationError).failures as Record<string, string[]>
}

const BACKEND = tag('tag-backend', 'Backend')
const UX = tag('tag-ux', 'UX', { color: '#E879A6' })

describe('TagService.catalog', () => {
  const links: Link[] = [
    { ideaId: 'i1', tagId: BACKEND.id, boardId: 'b-z', boardName: 'zeta', isDeleted: false },
    { ideaId: 'i2', tagId: BACKEND.id, boardId: 'b-a', boardName: 'Alpha', isDeleted: false },
    { ideaId: 'i3', tagId: BACKEND.id, boardId: 'b-a', boardName: 'Alpha', isDeleted: false },
    { ideaId: 'i4', tagId: BACKEND.id, boardId: 'b-q', boardName: 'Quiet', isDeleted: true },
  ]

  it.each([
    ['an Org Admin', orgAdmin()],
    ['a member', member()],
    ['Read Only', readOnly()],
    ['a Site Admin', siteAdmin()],
  ])('is readable by %s', async (_label, currentUser) => {
    const { service } = setup({ currentUser, tags: [BACKEND, UX], links })
    const items = await service.catalog(ORG_A)
    expect(items.map((i) => i.name)).toEqual(['Backend', 'UX'])
  })

  it('answers the tag item shape with live usage, boards by name, and the creator', async () => {
    const { service } = setup({ currentUser: member(), tags: [UX, BACKEND], links })
    const [backend, ux] = await service.catalog(ORG_A)

    expect(backend).toEqual({
      tagId: BACKEND.id,
      name: 'Backend',
      color: '#6B9BF2',
      ideaCount: 3,
      boards: [
        { boardId: 'b-a', name: 'Alpha' },
        { boardId: 'b-z', name: 'zeta' },
      ],
      createdAtUtc: CREATED,
      createdBy: { userId: 'org-admin-1', displayName: 'Olive Admin' },
    })
    expect(ux).toMatchObject({ ideaCount: 0, boards: [] })
  })

  it('orders by name case-insensitively', async () => {
    const tags = [tag('t1', 'beta'), tag('t2', 'Alpha'), tag('t3', 'gamma'), tag('t4', 'Delta')]
    const { service } = setup({ currentUser: member(), tags })
    expect((await service.catalog(ORG_A)).map((i) => i.name)).toEqual([
      'Alpha',
      'beta',
      'Delta',
      'gamma',
    ])
  })

  it('reads a fixed number of times however many tags there are', async () => {
    const many = Array.from({ length: 40 }, (_, i) => tag(`t${i}`, `tag ${i}`))
    const one = setup({ currentUser: member(), tags: [BACKEND] })
    const forty = setup({ currentUser: member(), tags: many })

    await one.service.catalog(ORG_A)
    await forty.service.catalog(ORG_A)

    expect(forty.calls).toEqual(one.calls)
    expect(forty.calls).toMatchObject({
      listByOrganization: 1,
      usageByTagIds: 1,
      getCreatorNames: 1,
    })
  })

  it('answers an empty array without reading usage', async () => {
    const { service, calls } = setup({ currentUser: member() })
    expect(await service.catalog(ORG_A)).toEqual([])
    expect(calls.usageByTagIds).toBe(0)
  })

  it('is a 404 for another organization and 401 anonymously', async () => {
    expect(
      await rejection(setup({ currentUser: member(ORG_B) }).service.catalog(ORG_A)),
    ).toBeInstanceOf(NotFoundError)
    expect(
      await rejection(setup({ currentUser: siteAdmin() }).service.catalog('org-missing')),
    ).toBeInstanceOf(NotFoundError)
    expect(
      await rejection(setup({ currentUser: anonymous }).service.catalog(ORG_A)),
    ).toBeInstanceOf(UnauthorizedError)
  })
})

describe('TagService.create', () => {
  it('adds an unused tag with the given colour upper case, and writes no audit event', async () => {
    const { service, audit, tagsById } = setup({ currentUser: orgAdmin() })

    const item = await service.create(ORG_A, { name: '  Payments ', color: '#abcdef' })

    expect(item).toMatchObject({
      name: 'Payments',
      color: '#ABCDEF',
      ideaCount: 0,
      boards: [],
      createdAtUtc: NOW,
      createdBy: { userId: 'org-admin-1', displayName: 'Olive Admin' },
    })
    expect(tagsById.get(item.tagId)).toMatchObject({
      organizationId: ORG_A,
      normalizedName: 'payments',
    })
    expect(audit.events).toEqual([])
  })

  it.each(TAG_COLOR_PALETTE.map((color, index) => [index, color] as const))(
    'takes the palette colour the random source draws when color is null (index %i)',
    async (index, color) => {
      const draws: number[] = []
      const { service } = setup({
        currentUser: orgAdmin(),
        random: {
          nextInt: (max) => {
            draws.push(max)
            return index
          },
        },
      })

      const item = await service.create(ORG_A, { name: 'Fresh', color: null })

      expect(item.color).toBe(color)
      expect(draws).toEqual([TAG_COLOR_PALETTE.length])
    },
  )

  it('does not draw a random colour when one is given', async () => {
    const { service } = setup({
      currentUser: orgAdmin(),
      random: {
        nextInt: () => {
          throw new Error('drawn')
        },
      },
    })
    await expect(service.create(ORG_A, { name: 'Fresh', color: '#000000' })).resolves.toMatchObject(
      { color: '#000000' },
    )
  })

  it.each(['Backend', 'backend', '  BACKEND  '])(
    'refuses %j as a duplicate, keyed name',
    async (name) => {
      const { service, calls } = setup({ currentUser: orgAdmin(), tags: [BACKEND] })
      expect(await fieldErrors(service.create(ORG_A, { name, color: null }))).toEqual({
        name: [DUPLICATE_TAG_NAME_MESSAGE],
      })
      expect(DUPLICATE_TAG_NAME_MESSAGE).toBe('A tag with this name already exists.')
      expect(calls.add).toBe(0)
    },
  )

  it("allows another organization's name", async () => {
    const { service } = setup({
      currentUser: orgAdmin(ORG_B),
      tags: [BACKEND],
    })
    await expect(service.create(ORG_B, { name: 'Backend', color: null })).resolves.toMatchObject({
      name: 'Backend',
    })
  })

  it('names every bad field in one response', async () => {
    const { service } = setup({ currentUser: orgAdmin() })
    expect(await fieldErrors(service.create(ORG_A, { name: '  ', color: 'teal' }))).toEqual({
      name: ['Tag name is required.'],
      color: ['Color must be a valid #RRGGBB color.'],
    })
    expect(
      await fieldErrors(service.create(ORG_A, { name: 'x'.repeat(101), color: null })),
    ).toEqual({ name: ['Tag must be 100 characters or fewer.'] })
  })

  it.each([
    ['a member', member(), ForbiddenError],
    ['Read Only', readOnly(), ForbiddenError],
    ['a Site Admin acting directly', siteAdmin(), ForbiddenError],
    ['an Org Admin of another organization', orgAdmin(ORG_B), NotFoundError],
    ['an anonymous caller', anonymous, UnauthorizedError],
  ])('refuses %s before looking at the body', async (_label, currentUser, expected) => {
    const { service, calls } = setup({ currentUser })
    const error = await rejection(service.create(ORG_A, { name: '', color: 'bad' }))
    expect(error).toBeInstanceOf(expected)
    expect(calls.add).toBe(0)
  })

  it('lets a Site Admin create through View As as an Org Admin', async () => {
    const { service } = setup({
      currentUser: impersonating({
        targetUserId: 'org-admin-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    })
    await expect(service.create(ORG_A, { name: 'Viewed', color: null })).resolves.toMatchObject({
      createdBy: { userId: 'org-admin-1' },
    })
  })

  it('refuses a Site Admin viewing as a member', async () => {
    const { service } = setup({
      currentUser: impersonating({
        targetUserId: 'user-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })
    expect(await rejection(service.create(ORG_A, { name: 'x', color: null }))).toBeInstanceOf(
      ForbiddenError,
    )
  })
})

describe('TagService.update', () => {
  const links: Link[] = [
    { ideaId: 'i1', tagId: BACKEND.id, boardId: 'b1', boardName: 'One', isDeleted: false },
    { ideaId: 'i2', tagId: BACKEND.id, boardId: 'b1', boardName: 'One', isDeleted: false },
    { ideaId: 'i3', tagId: BACKEND.id, boardId: 'b1', boardName: 'One', isDeleted: true },
  ]

  it('renames and writes one TagRenamed event with the live idea count', async () => {
    const { service, audit } = setup({ currentUser: orgAdmin(), tags: [BACKEND, UX], links })

    const item = await service.update(BACKEND.id, { name: 'Platform', color: null })

    expect(item).toMatchObject({ name: 'Platform', color: '#6B9BF2', ideaCount: 2 })
    expect(audit.events).toHaveLength(1)
    const [event] = audit.events
    expect(event).toMatchObject({
      eventType: 'TagRenamed',
      entityType: 'Tag',
      entityId: BACKEND.id,
      organizationId: ORG_A,
      occurredAtUtc: NOW,
      attribution: { actorUserId: 'org-admin-1', onBehalfOfUserId: null },
    })
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({
      tagId: BACKEND.id,
      oldName: 'Backend',
      newName: 'Platform',
      ideaCount: 2,
    })
  })

  it('allows a case-only rename of the same tag and audits it', async () => {
    const { service, audit } = setup({ currentUser: orgAdmin(), tags: [BACKEND] })

    const item = await service.update(BACKEND.id, { name: 'BACKEND', color: null })

    expect(item.name).toBe('BACKEND')
    expect(audit.events.map((e) => e.eventType)).toEqual(['TagRenamed'])
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({
      oldName: 'Backend',
      newName: 'BACKEND',
    })
  })

  it('writes nothing for a colour-only edit, or for an unchanged name after trimming', async () => {
    const { service, audit, tagsById } = setup({ currentUser: orgAdmin(), tags: [BACKEND] })

    await service.update(BACKEND.id, { name: 'Backend', color: '#e5484d' })
    await service.update(BACKEND.id, { name: '  Backend  ', color: null })

    expect(tagsById.get(BACKEND.id)?.color).toBe('#E5484D')
    expect(audit.events).toEqual([])
  })

  it('keeps the stored colour when color is null', async () => {
    const { service, tagsById } = setup({ currentUser: orgAdmin(), tags: [UX] })
    await service.update(UX.id, { name: 'UX', color: null })
    expect(tagsById.get(UX.id)?.color).toBe('#E879A6')
  })

  it("refuses renaming onto another tag's normalized name, with no merge", async () => {
    const { service, calls, audit } = setup({ currentUser: orgAdmin(), tags: [BACKEND, UX] })
    expect(await fieldErrors(service.update(UX.id, { name: ' backend ', color: null }))).toEqual({
      name: [DUPLICATE_TAG_NAME_MESSAGE],
    })
    expect(calls.save).toBe(0)
    expect(audit.events).toEqual([])
  })

  it('refuses a bad colour keyed color', async () => {
    const { service } = setup({ currentUser: orgAdmin(), tags: [BACKEND] })
    expect(
      await fieldErrors(service.update(BACKEND.id, { name: 'Backend', color: '#12345' })),
    ).toEqual({ color: ['Color must be a valid #RRGGBB color.'] })
  })

  it('is a 404 for a missing tag and for another organization, before the role or body', async () => {
    const missing = setup({ currentUser: orgAdmin(), tags: [BACKEND] })
    expect(await rejection(missing.service.update('nope', { name: 'x', color: null }))).toEqual(
      new NotFoundError('Tag not found.'),
    )

    for (const currentUser of [orgAdmin(ORG_B), member(ORG_B), readOnly(ORG_B)]) {
      const { service } = setup({ currentUser, tags: [BACKEND] })
      expect(await rejection(service.update(BACKEND.id, { name: '', color: 'x' }))).toBeInstanceOf(
        NotFoundError,
      )
    }
  })

  it.each([
    ['a member', member(), ForbiddenError],
    ['Read Only', readOnly(), ForbiddenError],
    ['a Site Admin acting directly', siteAdmin(), ForbiddenError],
    ['an anonymous caller', anonymous, UnauthorizedError],
  ])('refuses %s before looking at the body', async (_label, currentUser, expected) => {
    const { service, calls } = setup({ currentUser, tags: [BACKEND] })
    expect(await rejection(service.update(BACKEND.id, { name: '', color: 'x' }))).toBeInstanceOf(
      expected,
    )
    expect(calls.save).toBe(0)
  })

  it('attributes a rename through View As to the administrator', async () => {
    const { service, audit } = setup({
      currentUser: impersonating({
        targetUserId: 'org-admin-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-9',
      }),
      tags: [BACKEND],
    })
    await service.update(BACKEND.id, { name: 'Renamed', color: null })
    expect(audit.events[0]?.attribution).toMatchObject({
      actorUserId: 'site-admin-9',
      onBehalfOfUserId: 'org-admin-1',
    })
  })
})

describe('TagService.delete', () => {
  const links: Link[] = [
    { ideaId: 'i1', tagId: BACKEND.id, boardId: 'b1', boardName: 'One', isDeleted: false },
    { ideaId: 'i2', tagId: BACKEND.id, boardId: 'b2', boardName: 'Archived', isDeleted: false },
    { ideaId: 'i3', tagId: BACKEND.id, boardId: 'b1', boardName: 'One', isDeleted: true },
    { ideaId: 'i1', tagId: UX.id, boardId: 'b1', boardName: 'One', isDeleted: false },
  ]

  it('removes the tag and its links, and writes one TagDeleted event with the live count', async () => {
    const {
      service,
      audit,
      tagsById,
      links: remaining,
    } = setup({
      currentUser: orgAdmin(),
      tags: [BACKEND, UX],
      links,
    })

    await service.delete(BACKEND.id)

    expect(tagsById.has(BACKEND.id)).toBe(false)
    expect(remaining().map((l) => l.tagId)).toEqual([UX.id])
    expect(audit.events).toHaveLength(1)
    expect(audit.events[0]).toMatchObject({
      eventType: 'TagDeleted',
      entityType: 'Tag',
      entityId: BACKEND.id,
      organizationId: ORG_A,
      occurredAtUtc: NOW,
    })
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toEqual({
      tagId: BACKEND.id,
      name: 'Backend',
      ideaCount: 2,
    })
  })

  it('records zero for an unused tag', async () => {
    const { service, audit } = setup({ currentUser: orgAdmin(), tags: [UX] })
    await service.delete(UX.id)
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({ ideaCount: 0 })
  })

  it.each([
    ['a member', member(), ForbiddenError],
    ['Read Only', readOnly(), ForbiddenError],
    ['a Site Admin acting directly', siteAdmin(), ForbiddenError],
    ['an Org Admin of another organization', orgAdmin(ORG_B), NotFoundError],
    ['an anonymous caller', anonymous, UnauthorizedError],
  ])('refuses %s and deletes nothing', async (_label, currentUser, expected) => {
    const { service, calls, audit } = setup({ currentUser, tags: [BACKEND], links })
    expect(await rejection(service.delete(BACKEND.id))).toBeInstanceOf(expected)
    expect(calls.delete).toBe(0)
    expect(audit.events).toEqual([])
  })

  it('is a 404 for a missing tag', async () => {
    const { service } = setup({ currentUser: orgAdmin() })
    expect(await rejection(service.delete('nope'))).toBeInstanceOf(NotFoundError)
  })

  it('writes no event when the delete itself fails', async () => {
    const { service, audit } = setup({
      currentUser: orgAdmin(),
      tags: [BACKEND],
      deleteFails: true,
    })
    expect(await rejection(service.delete(BACKEND.id))).toBeInstanceOf(NotFoundError)
    expect(audit.events).toEqual([])
  })
})
