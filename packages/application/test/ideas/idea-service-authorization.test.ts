// Cross-organization isolation and the four-role matrix for IdeaService
// (SPEC/20-feature-ideas-and-engagement.md "Permissions", SPEC/20-feature-view-as.md rules 25-26).
//
// The two properties every test here is about:
//   1. A caller bound to org A can neither read nor write anything belonging to org B, and is told
//      "not found" rather than "forbidden", so the refusal does not confirm the row exists.
//   2. A Site Admin acting as themselves reads everything and mutates nothing.

import { IdeaPhase, Role, SprintState } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import {
  impersonating,
  member as memberContext,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_A,
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  LIST_QUERY,
  ORG_LIST_QUERY,
  promotedIdea,
  STATUS_1,
  STATUS_2,
  summary,
  TYPE_A,
  updateFrom,
} from './idea-service-harness.js'

// Cross-organization isolation -------------------------------------------------------------

describe('IdeaService cross-organization isolation', () => {
  const foreignBoard = board({ boardId: BOARD_B, organizationId: ORG_B, name: 'Beta Board' })
  const foreignIdea = idea({ id: 'idea-b', organizationId: ORG_B, boardId: BOARD_B })

  const callers: readonly [string, () => CurrentUserContext][] = [
    ['OrgAdmin', () => orgAdmin(ORG_A)],
    ['User', () => memberContext(ORG_A)],
    ['ReadOnly', () => readOnly(ORG_A)],
  ]

  describe.each(callers)("a %s of org A against org B's data", (_label, caller) => {
    it('cannot list another organization’s board', async () => {
      const { service } = harness({ currentUser: caller(), boards: [foreignBoard] })
      await expect(service.listByBoard(BOARD_B, LIST_QUERY)).rejects.toThrow(NotFoundError)
    })

    it('cannot read another organization’s idea', async () => {
      const { service } = harness({
        currentUser: caller(),
        boards: [foreignBoard],
        ideas: [foreignIdea],
      })
      await expect(service.getById('idea-b')).rejects.toThrow(NotFoundError)
    })

    it('cannot enumerate another organization’s idea list', async () => {
      const { service } = harness({ currentUser: caller(), ideas: [foreignIdea] })
      await expect(service.listByOrganization(ORG_B, ORG_LIST_QUERY)).rejects.toThrow(NotFoundError)
    })

    it('cannot create an idea on another organization’s board', async () => {
      const { service, added } = harness({ currentUser: caller(), boards: [foreignBoard] })
      await expect(service.create(BOARD_B, CREATE)).rejects.toThrow()
      expect(added).toHaveLength(0)
    })

    it('cannot change the status of another organization’s idea', async () => {
      const { service, saved } = harness({
        currentUser: caller(),
        boards: [foreignBoard],
        ideas: [foreignIdea],
      })
      await expect(service.changeStatus('idea-b', { statusId: STATUS_2 })).rejects.toThrow()
      expect(saved).toHaveLength(0)
    })

    it('cannot delete another organization’s idea', async () => {
      const { service, saved } = harness({ currentUser: caller(), ideas: [foreignIdea] })
      await expect(service.delete('idea-b')).rejects.toThrow()
      expect(saved).toHaveLength(0)
    })

    it('cannot read another organization’s delivery board', async () => {
      const { service } = harness({ currentUser: caller() })
      await expect(
        service.listDelivery(ORG_B, { sprintId: null, deliveryStatus: null }),
      ).rejects.toThrow(NotFoundError)
    })

    it('cannot export another organization’s board', async () => {
      const { service } = harness({ currentUser: caller(), boards: [foreignBoard] })
      await expect(service.exportBoardIdeas(BOARD_B)).rejects.toThrow(NotFoundError)
    })
  })

  it('refuses a cross-organization read with not-found, never forbidden - a 403 would confirm the idea exists', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ideas: [foreignIdea] })

    await expect(service.getById('idea-b')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('scopes the repository query itself, so the store is never asked for another organization', async () => {
    const { service, orgFilters } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    expect(orgFilters).toHaveLength(1)
    expect(orgFilters[0]?.organizationId).toBe(ORG_A)
  })

  it('refuses an out-of-organization sprint as a promotion target', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [
        {
          id: 'sprint-b',
          organizationId: ORG_B,
          name: 'Beta Sprint',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
          state: SprintState.Planned,
          isDeleted: false,
        },
      ],
    })

    await expect(
      service.promote('idea-1', { effort: 'Medium', sprintId: 'sprint-b', note: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses an assignee who belongs to another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [summary({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(
      service.create(BOARD_A, { ...CREATE, assigneeUserIds: ['outsider'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses a mention of a user in another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [summary({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(
      service.create(BOARD_A, { ...CREATE, mentionEmails: ['out@beta.test'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses an Idea Type belonging to another organization', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.create(BOARD_A, { ...CREATE, ideaTypeId: 'type-b' })).rejects.toThrow(
      ValidationError,
    )
  })

  it('refuses a Business Impact belonging to another organization', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.create(BOARD_A, { ...CREATE, businessImpactId: 'impact-b' }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses reassigning an idea’s type through a mismatched organization id in the route', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })

    // The caller may administer the idea, but the route names a different organization: the
    // mismatch is refused on the route id, not only on the caller's own scope.
    await expect(service.reassignIdeaType(ORG_B, 'idea-1', TYPE_A)).rejects.toThrow(NotFoundError)
  })
})

// The four-role matrix ------------------------------------------------------------------------

describe('IdeaService role matrix', () => {
  it('lets a Site Admin read any organization’s board', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      boards: [board({ boardId: BOARD_B, organizationId: ORG_B })],
    })

    await expect(service.listByBoard(BOARD_B, LIST_QUERY)).resolves.toMatchObject({ items: [] })
  })

  it('refuses a direct Site Admin every organization-content mutation (rule 25)', async () => {
    const { service, added, saved } = harness({
      currentUser: siteAdmin(),
      ideas: [idea()],
      sprints: [],
    })

    await expect(service.create(BOARD_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('idea-1', updateFrom(idea()))).rejects.toThrow(ForbiddenError)
    await expect(service.changeStatus('idea-1', { statusId: STATUS_2 })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.delete('idea-1')).rejects.toThrow(ForbiddenError)
    await expect(
      service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ).rejects.toThrow(ForbiddenError)
    await expect(service.returnToDiscovery('idea-1')).rejects.toThrow(ForbiddenError)
    await expect(service.assignToSprint('idea-1', { sprintId: null })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.importBoardIdeas(BOARD_A, [])).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('lets that same Site Admin create once they act through View As (rule 25 has no impersonation branch)', async () => {
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: AUTHOR,
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.create(BOARD_A, CREATE)

    expect(added).toHaveLength(1)
    expect(added[0]?.organizationId).toBe(ORG_A)
    // Rule 15: authorship records the TARGET, never the administrator.
    expect(added[0]?.authorUserId).toBe(AUTHOR)
  })

  it('attributes an idea created through View As to the administrator, on behalf of the target (rule 14)', async () => {
    const { service, audit } = harness({
      currentUser: impersonating({
        targetUserId: AUTHOR,
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await service.create(BOARD_A, CREATE)

    const created = audit.events.find((e) => e.eventType === 'IdeaCreated')
    expect(created?.attribution.actorUserId).toBe('site-admin-1')
    expect(created?.attribution.onBehalfOfUserId).toBe(AUTHOR)
  })

  it('refuses Read Only every idea-edit path but leaves reads open', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A), ideas: [idea()] })

    await expect(service.create(BOARD_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('idea-1', updateFrom(idea()))).rejects.toThrow(ForbiddenError)
    await expect(service.importBoardIdeas(BOARD_A, [])).rejects.toThrow(ForbiddenError)
    await expect(
      service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ).rejects.toThrow(ForbiddenError)

    await expect(service.getById('idea-1')).resolves.toMatchObject({ ideaId: 'idea-1' })
    await expect(service.listByBoard(BOARD_A, LIST_QUERY)).resolves.toBeDefined()
  })

  it('refuses Read Only a status move even on a board that opts users in', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      boards: [board({ allowUserStatusUpdate: true })],
      ideas: [idea()],
    })

    await expect(service.changeStatus('idea-1', { statusId: STATUS_2 })).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('lets a User move an idea only when the board opts in (rule #34)', async () => {
    const opted = harness({
      currentUser: memberContext(ORG_A),
      boards: [board({ allowUserStatusUpdate: true })],
      ideas: [idea()],
    })
    await opted.service.changeStatus('idea-1', { statusId: STATUS_2 })
    expect(opted.saved).toHaveLength(1)

    const locked = harness({
      currentUser: memberContext(ORG_A),
      boards: [board({ allowUserStatusUpdate: false })],
      ideas: [idea()],
    })
    await expect(locked.service.changeStatus('idea-1', { statusId: STATUS_2 })).rejects.toThrow(
      ForbiddenError,
    )
    expect(locked.saved).toHaveLength(0)
  })

  it('lets an Org Admin move an idea regardless of the board setting', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ allowUserStatusUpdate: false })],
      ideas: [idea()],
    })

    await service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(saved).toHaveLength(1)
  })

  it('restricts description and assignee edits to the author or an in-scope admin', async () => {
    const stranger = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [idea()],
    })
    await expect(
      stranger.service.update('idea-1', {
        ...updateFrom(idea()),
        description: 'A rewritten description',
      }),
    ).rejects.toThrow(ForbiddenError)

    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [idea()] })
    await expect(
      author.service.update('idea-1', {
        ...updateFrom(idea()),
        description: 'A rewritten description',
      }),
    ).resolves.toBeDefined()
  })

  it('lets a non-author User edit non-restricted fields on someone else’s idea', async () => {
    const { service, saved } = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [idea()],
    })

    await service.update('idea-1', { ...updateFrom(idea()), title: 'A better title' })

    expect(saved).toHaveLength(1)
  })

  it('restricts deletion to an admin - the author alone is not enough (rule #16)', async () => {
    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [idea()] })
    await expect(author.service.delete('idea-1')).rejects.toThrow(ForbiddenError)

    const admin = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })
    await admin.service.delete('idea-1')
    expect(admin.saved[0]?.isDeleted).toBe(true)
  })

  it('refuses an Org Admin of another organization the admin-only paths', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_B), ideas: [idea()] })

    // `delete` deliberately has no separate scope check - `canAdministerIdeaContent`'s own
    // organization comparison is what a cross-org Org Admin fails.
    await expect(service.delete('idea-1')).rejects.toThrow(ForbiddenError)
    expect(saved).toHaveLength(0)
  })

  it('lets the author promote their own idea, and refuses a bystander', async () => {
    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [idea()] })
    await author.service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null })
    expect(author.saved).toHaveLength(1)

    const bystander = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [idea()],
    })
    await expect(
      bystander.service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('restricts returning an issue to discovery to admins - not the author', async () => {
    const promoted = promotedIdea()
    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [promoted] })
    await expect(author.service.returnToDiscovery('idea-1')).rejects.toThrow(ForbiddenError)

    const admin = harness({ currentUser: orgAdmin(ORG_A), ideas: [promoted] })
    await admin.service.returnToDiscovery('idea-1')
    expect(admin.saved).toHaveLength(1)
  })

  it('lets an assignee change delivery status, and refuses an unrelated member', async () => {
    const promoted = promotedIdea({ assigneeUserIds: ['helper-1'] })

    const assignee = harness({ currentUser: memberContext(ORG_A, 'helper-1'), ideas: [promoted] })
    await assignee.service.changeDeliveryStatus('idea-1', { deliveryStatus: 'Development' })
    expect(assignee.saved).toHaveLength(1)

    const bystander = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [promoted],
    })
    await expect(
      bystander.service.changeDeliveryStatus('idea-1', { deliveryStatus: 'Development' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('lets every role including Read Only read the delivery board', async () => {
    for (const caller of [siteAdmin(), orgAdmin(ORG_A), memberContext(ORG_A), readOnly(ORG_A)]) {
      const { service } = harness({ currentUser: caller })
      await expect(
        service.listDelivery(ORG_A, { sprintId: null, deliveryStatus: null }),
      ).resolves.toEqual([])
    }
  })
})

// Board-scoped behaviour that the authorization rules rest on --------------------------------

describe('IdeaService board scoping', () => {
  it('filters the ideation board to Discovery, so a promoted item leaves it', async () => {
    const { service, boardFilters } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(boardFilters[0]?.phase).toBe(IdeaPhase.Discovery)
  })

  it('defaults the organization list to both phases, so a promoted item is still findable', async () => {
    const { service, orgFilters } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    expect(orgFilters[0]?.phase).toBeNull()
  })

  it('narrows the organization list to the caller when scope is "created"', async () => {
    const { service, orgFilters } = harness({ currentUser: memberContext(ORG_A, 'me') })

    await service.listByOrganization(ORG_A, { ...ORG_LIST_QUERY, scope: 'created' })

    expect(orgFilters[0]?.createdByUserId).toBe('me')
    expect(orgFilters[0]?.assignedToUserId).toBeNull()
  })

  it('rejects a status that is not a swimlane on the board', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.create(BOARD_A, { ...CREATE, statusId: 'status-elsewhere' }),
    ).rejects.toThrow(ValidationError)
  })

  it('defaults a new idea to the left-most swimlane (rule #27)', async () => {
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [
        board({
          swimlanes: [
            { statusId: STATUS_2, displayOrder: 5 },
            { statusId: STATUS_1, displayOrder: 1 },
          ],
        }),
      ],
    })

    await service.create(BOARD_A, CREATE)

    expect(added[0]?.statusId).toBe(STATUS_1)
  })

  it('excludes a soft-deleted idea from reads (rule #11)', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ isDeleted: true })],
    })

    await expect(service.getById('idea-1')).rejects.toThrow(NotFoundError)
  })

  it('refuses to change an idea’s type on the ordinary edit path', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })

    await expect(
      service.update('idea-1', { ...updateFrom(idea()), ideaTypeId: 'type-other' }),
    ).rejects.toThrow(ValidationError)
  })

  it('notifies mentioned users on create, and nobody else', async () => {
    const mentioned = summary({ id: 'mentioned-1', email: 'mentioned@acme.test' })
    const { service, notifications } = harness({
      currentUser: memberContext(ORG_A, AUTHOR),
      users: [summary(), mentioned],
    })

    await service.create(BOARD_A, { ...CREATE, mentionEmails: ['mentioned@acme.test'] })

    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      eventType: 'IdeaMention',
      recipientUserId: 'mentioned-1',
      organizationId: ORG_A,
    })
  })
})
