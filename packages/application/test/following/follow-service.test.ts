// Following and unfollowing for the caller only (SPEC/20-feature-idea-following.md rules 1-3, 8;
// SPEC/contracts/following.md). Read Only may follow - following is a read - and a Site Admin
// acting as themselves may not, as with upvoting. Through View As the caller is the target.

import { Role } from '@collega/domain/enums'
import type { IdeaFollower } from '@collega/domain/followers'
import { describe, expect, it } from 'vitest'
import {
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/common/index.js'
import { FollowService } from '../../src/following/follow.service.js'
import type { IdeaFollowerRepository, IdeaLookupPort } from '../../src/following/ports.js'
import {
  anonymous,
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'

const IDEA_A = 'idea-a'
const IDEA_B = 'idea-b'
const IDEA_DELETED = 'idea-deleted'

function followHarness(options: {
  currentUser: CurrentUserContext
  /** user ids that already follow IDEA_A */
  followers?: readonly string[]
}) {
  // Rows by "idea|user"; staged writes land here at once, which is all these tests need to see.
  const rows = new Map<string, IdeaFollower>()
  for (const userId of options.followers ?? []) {
    rows.set(`${IDEA_A}|${userId}`, {
      id: `seed-${userId}`,
      ideaId: IDEA_A,
      userId,
      createdAtUtc: NOW,
    } as IdeaFollower)
  }
  const calls = { adds: 0, removes: 0 }
  const uow = countingUnitOfWork()

  const followers: IdeaFollowerRepository = {
    async add(list) {
      calls.adds++
      for (const row of list) {
        rows.set(`${row.ideaId}|${row.userId}`, row)
      }
    },
    async remove(ideaId, userId) {
      calls.removes++
      rows.delete(`${ideaId}|${userId}`)
    },
    async isFollowing(ideaId, userId) {
      return rows.has(`${ideaId}|${userId}`)
    },
    async countByIdea(ideaId) {
      return [...rows.values()].filter((r) => r.ideaId === ideaId).length
    },
  }
  // A soft-deleted idea is not returned by the lookup, as the port documents.
  const known = new Map([
    [IDEA_A, { organizationId: ORG_A }],
    [IDEA_B, { organizationId: ORG_B }],
  ])
  const ideas: IdeaLookupPort = {
    async getById(id) {
      return known.get(id) ?? null
    },
  }

  return {
    service: new FollowService(followers, ideas, uow, options.currentUser, fixedClock()),
    rows,
    calls,
    uow,
  }
}

describe('FollowService.follow', () => {
  it.each([
    ['a User', member(ORG_A, 'u-1')],
    ['an Org Admin', orgAdmin(ORG_A, 'u-1')],
    ['a Read Only member', readOnly(ORG_A, 'u-1')],
  ])('lets %s follow an idea in their organization', async (_label, currentUser) => {
    const h = followHarness({ currentUser, followers: ['other'] })

    const result = await h.service.follow(IDEA_A)

    expect(result).toEqual({ ideaId: IDEA_A, isFollowing: true, followerCount: 2 })
    expect(h.rows.has(`${IDEA_A}|u-1`)).toBe(true)
    expect(h.uow.saves).toBe(1)
  })

  it('stamps the row with the caller, the idea and the injected clock', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1') })

    await h.service.follow(IDEA_A)

    expect(h.rows.get(`${IDEA_A}|u-1`)).toMatchObject({
      ideaId: IDEA_A,
      userId: 'u-1',
      createdAtUtc: NOW,
    })
  })

  it('is idempotent: following again writes nothing and commits nothing', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1'), followers: ['u-1', 'other'] })

    const result = await h.service.follow(IDEA_A)

    expect(result).toEqual({ ideaId: IDEA_A, isFollowing: true, followerCount: 2 })
    expect(h.calls.adds).toBe(0)
    expect(h.uow.saves).toBe(0)
  })

  it('applies to the caller only: nobody else gains a row', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1'), followers: ['other'] })

    await h.service.follow(IDEA_A)

    expect([...h.rows.keys()].sort()).toEqual([`${IDEA_A}|other`, `${IDEA_A}|u-1`])
  })

  it('refuses a Site Admin acting as themselves with 403 and writes nothing', async () => {
    const h = followHarness({ currentUser: siteAdmin() })

    await expect(h.service.follow(IDEA_A)).rejects.toBeInstanceOf(ForbiddenError)

    expect(h.rows.size).toBe(0)
    expect(h.uow.saves).toBe(0)
  })

  it('follows as the target under View As, not as the administrator', async () => {
    const h = followHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.ReadOnly,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await h.service.follow(IDEA_A)

    expect([...h.rows.keys()]).toEqual([`${IDEA_A}|target-1`])
  })

  it('answers 404 for an idea that does not exist or is soft-deleted', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1') })

    await expect(h.service.follow('no-such-idea')).rejects.toBeInstanceOf(NotFoundError)
    await expect(h.service.follow(IDEA_DELETED)).rejects.toBeInstanceOf(NotFoundError)
    expect(h.rows.size).toBe(0)
  })

  it('answers 404, not 403, for an idea in another organization', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1') })

    await expect(h.service.follow(IDEA_B)).rejects.toBeInstanceOf(NotFoundError)
    expect(h.rows.size).toBe(0)
  })

  it('refuses an unauthenticated caller', async () => {
    const h = followHarness({ currentUser: anonymous })

    await expect(h.service.follow(IDEA_A)).rejects.toBeInstanceOf(UnauthorizedError)
  })
})

describe('FollowService.unfollow', () => {
  it('removes only the caller row and reports the remaining count', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1'), followers: ['u-1', 'other'] })

    const result = await h.service.unfollow(IDEA_A)

    expect(result).toEqual({ ideaId: IDEA_A, isFollowing: false, followerCount: 1 })
    expect([...h.rows.keys()]).toEqual([`${IDEA_A}|other`])
    expect(h.uow.saves).toBe(1)
  })

  it('is idempotent: unfollowing when not following removes and commits nothing', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1'), followers: ['other'] })

    const result = await h.service.unfollow(IDEA_A)

    expect(result).toEqual({ ideaId: IDEA_A, isFollowing: false, followerCount: 1 })
    expect(h.calls.removes).toBe(0)
    expect(h.uow.saves).toBe(0)
  })

  it('lets Read Only unfollow', async () => {
    const h = followHarness({ currentUser: readOnly(ORG_A, 'u-1'), followers: ['u-1'] })

    await expect(h.service.unfollow(IDEA_A)).resolves.toMatchObject({ isFollowing: false })
  })

  it('refuses a Site Admin acting as themselves with 403', async () => {
    const h = followHarness({ currentUser: siteAdmin() })

    await expect(h.service.unfollow(IDEA_A)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('unfollows as the target under View As', async () => {
    const h = followHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
      followers: ['target-1', 'site-admin-1'],
    })

    await h.service.unfollow(IDEA_A)

    expect([...h.rows.keys()]).toEqual([`${IDEA_A}|site-admin-1`])
  })

  it('answers 404 for a missing, soft-deleted or other-organization idea', async () => {
    const h = followHarness({ currentUser: member(ORG_A, 'u-1') })

    for (const ideaId of ['no-such-idea', IDEA_DELETED, IDEA_B]) {
      await expect(h.service.unfollow(ideaId)).rejects.toBeInstanceOf(NotFoundError)
    }
  })
})
