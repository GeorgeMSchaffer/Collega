// QA for ideas with no board (SPEC/20-feature-board-pull-in.md rules 2 to 6, 8 and 19): detach
// (who, archived boards, Issues, idempotence, silence, audit), the pool create and the status
// route's refusal of a pool idea.

import { EffortLevel, Role } from '@collega/domain/enums'
import { promoteIdeaToIssue } from '@collega/domain/ideas'
import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../src/common/index.js'
import {
  anonymous,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_A,
  board,
  CREATE,
  harness,
  idea,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const authorCtx = () => member(ORG_A, AUTHOR)

describe('detachFromBoard: who may (rule 5)', () => {
  it.each([
    ['the author', authorCtx()],
    ['an Org Admin who is not the author', orgAdmin(ORG_A)],
  ])('lets %s detach', async (_label, currentUser) => {
    const h = harness({ currentUser, ideas: [idea()] })
    await h.service.detachFromBoard('idea-1')
    expect(h.saved[0]?.boardId).toBeNull()
  })

  it('refuses a User who is not the author, saving nothing', async () => {
    const h = harness({ currentUser: member(ORG_A, 'someone-else'), ideas: [idea()] })
    await expect(h.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(ForbiddenError)
    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('refuses a Read Only author', async () => {
    const h = harness({ currentUser: readOnly(ORG_A, AUTHOR), ideas: [idea()] })
    await expect(h.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(ForbiddenError)
    expect(h.saved).toHaveLength(0)
  })

  it('refuses a Site Admin acting as themselves', async () => {
    const h = harness({ currentUser: siteAdmin(), ideas: [idea()] })
    await expect(h.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(ForbiddenError)
    expect(h.saved).toHaveLength(0)
  })

  it('lets a Site Admin viewing as an Org Admin detach, audited under the real user', async () => {
    const viewAs = impersonating({
      targetUserId: 'org-admin-1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const h = harness({ currentUser: viewAs, ideas: [idea()] })
    await h.service.detachFromBoard('idea-1')
    expect(h.audit.events[0]?.attribution).toMatchObject({ actorUserId: 'site-admin-9' })
  })

  it("answers not found for another organization's idea and for a missing or deleted one", async () => {
    const foreign = harness({ currentUser: orgAdmin(ORG_B), ideas: [idea()] })
    await expect(foreign.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(NotFoundError)
    const missing = harness({ currentUser: orgAdmin(ORG_A), ideas: [] })
    await expect(missing.service.detachFromBoard('nope')).rejects.toBeInstanceOf(NotFoundError)
    const deleted = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea({ isDeleted: true })] })
    await expect(deleted.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('rejects an unauthenticated caller', async () => {
    const h = harness({ currentUser: anonymous, ideas: [idea()] })
    await expect(h.service.detachFromBoard('idea-1')).rejects.toThrow()
    expect(h.saved).toHaveLength(0)
  })
})

describe('detachFromBoard: an archived board (rule 6)', () => {
  const archived = board({ isArchived: true })

  it('lets an Org Admin detach', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), boards: [archived], ideas: [idea()] })
    await h.service.detachFromBoard('idea-1')
    expect(h.saved[0]?.boardId).toBeNull()
  })

  it('refuses the author, who is a User, with a conflict', async () => {
    const h = harness({ currentUser: authorCtx(), boards: [archived], ideas: [idea()] })
    await expect(h.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(ConflictError)
    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })
})

describe('detachFromBoard: an Issue (rule 5)', () => {
  const issue = promoteIdeaToIssue(
    idea(),
    { effort: EffortLevel.Low, sprintId: null, currentUpvoteCount: 0 },
    NOW,
    'promoter',
  )

  it.each([
    ['an Org Admin', orgAdmin(ORG_A)],
    ['the author', authorCtx()],
  ])('is a conflict for %s and saves nothing', async (_label, currentUser) => {
    const h = harness({ currentUser, ideas: [issue] })
    await expect(h.service.detachFromBoard('idea-1')).rejects.toBeInstanceOf(ConflictError)
    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })
})

describe('detachFromBoard: effects (rules 5 and 19)', () => {
  it('is idempotent for an idea already in the pool: no save, no audit', async () => {
    const h = harness({ currentUser: authorCtx(), ideas: [idea({ boardId: null })] })
    await expect(h.service.detachFromBoard('idea-1')).resolves.toBeUndefined()
    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('keeps status, stamps updatedAt and the actor, and clears the board', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ statusId: STATUS_2, tagIds: ['t1'], assigneeUserIds: ['u2'] })],
    })
    await h.service.detachFromBoard('idea-1')
    const saved = h.saved[0]
    expect(saved).toMatchObject({
      boardId: null,
      statusId: STATUS_2,
      tagIds: ['t1'],
      assigneeUserIds: ['u2'],
      updatedByUserId: 'org-admin-1',
    })
    expect(saved?.updatedAtUtc).toEqual(NOW)
  })

  it('writes exactly one IdeaBoardChanged with a null toBoardId and notifies no one', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })
    await h.service.detachFromBoard('idea-1')
    expect(h.audit.events).toHaveLength(1)
    expect(h.audit.events[0]).toMatchObject({ eventType: 'IdeaBoardChanged', entityId: 'idea-1' })
    expect(JSON.parse(h.audit.events[0]?.metadataJson ?? 'null')).toEqual({
      fromBoardId: BOARD_A,
      toBoardId: null,
    })
    expect(h.notifications).toHaveLength(0)
  })

  it('keeps followers untouched', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      followers: { 'idea-1': [AUTHOR, 'f2'] },
    })
    await h.service.detachFromBoard('idea-1')
    expect([...(h.followersByIdea.get('idea-1') ?? [])].sort()).toEqual([AUTHOR, 'f2'].sort())
  })
})

describe('createInPool (rules 3 and 4)', () => {
  it('creates a board-less idea with the first active status, audited as IdeaCreated', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), firstActiveStatusId: STATUS_2 })
    const result = await h.service.createInPool(ORG_A, CREATE)
    expect(result.boardId).toBeNull()
    expect(result.statusId).toBe(STATUS_2)
    expect(h.added[0]).toMatchObject({ boardId: null, statusId: STATUS_2, itemNumber: null })
    expect(h.audit.events.map((e) => e.eventType)).toContain('IdeaCreated')
  })

  it('makes the author follow the idea', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR) })
    const result = await h.service.createInPool(ORG_A, CREATE)
    expect(h.followersByIdea.get(result.ideaId)?.has(AUTHOR)).toBe(true)
  })

  it('ignores a client-supplied statusId', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), firstActiveStatusId: STATUS_1 })
    const result = await h.service.createInPool(ORG_A, { ...CREATE, statusId: STATUS_2 })
    expect(result.statusId).toBe(STATUS_1)
  })

  it('refuses with a 400 keyed statusId when the organization has no active status', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), firstActiveStatusId: null })
    await expect(h.service.createInPool(ORG_A, CREATE)).rejects.toMatchObject({
      failures: { statusId: expect.any(Array) },
    })
    expect(h.added).toHaveLength(0)
  })

  it.each([
    ['Read Only', readOnly(ORG_A)],
    ['a direct Site Admin', siteAdmin()],
  ])('refuses %s', async (_label, currentUser) => {
    const h = harness({ currentUser })
    await expect(h.service.createInPool(ORG_A, CREATE)).rejects.toBeInstanceOf(ForbiddenError)
    expect(h.added).toHaveLength(0)
  })

  it('lets an Org Admin create, and answers not found for another organization', async () => {
    await expect(
      harness({ currentUser: orgAdmin(ORG_A) }).service.createInPool(ORG_A, CREATE),
    ).resolves.toBeDefined()
    await expect(
      harness({ currentUser: orgAdmin(ORG_B) }).service.createInPool(ORG_A, CREATE),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('changeStatus on a pool idea (rule 2)', () => {
  it('is a 400 keyed statusId and changes nothing, even for an Org Admin', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea({ boardId: null })] })
    const error = await h.service
      .changeStatus('idea-1', { statusId: STATUS_2 })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({ failures: { statusId: ['This idea is not on a board.'] } })
    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })
})
