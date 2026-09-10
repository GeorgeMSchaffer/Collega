import { describe, expect, it } from 'vitest'
import { toCurrentUser, toIdea } from '@/lib/api/adapt'
import type { WireCurrentUser, WireIdeaListItem } from '@/lib/api/wire'

/**
 * The wire-to-view boundary.
 *
 * Role and priority arrive as free strings and leave as unions the screens index by, so this is
 * the last point at which an unrecognised value can be named. Past it, `PRIORITY_COLORS[priority]`
 * is `undefined`, the card's dot renders uncoloured — indistinguishable from `Low`, which is
 * uncoloured on purpose — and nothing anywhere says which value did it. That is why the adapters
 * throw rather than cast, and it is the assertion this file exists for.
 *
 * The wire fixtures are shaped after the corpus (`tools/golden/fixtures/auth.me.orgadmin.json`,
 * `ideas.list.board.orgadmin.json`) rather than invented, so a mapping that only works on data the
 * API never sends cannot pass here.
 */

const WIRE_USER: WireCurrentUser = {
  userId: '7edd9249-cc88-46e3-a3e1-354daf717e4f',
  organizationId: '182df148-cf57-4bba-ade8-99286b6c1181',
  role: 'OrgAdmin',
  firstName: 'Olivia',
  lastName: 'Administer',
  email: 'orgadmin@acme-robotics.demo.collega.test',
  status: 'Active',
  portraitDataUrl: null,
  viewingAs: null,
}

const WIRE_IDEA: WireIdeaListItem = {
  ideaId: '20111273-9308-42ff-80d4-1f527b4bd159',
  boardId: '182df148-cf57-4bba-ade8-99286b6c1181',
  title: 'Assembly cell reliability: Reduce manual handoffs',
  priority: 'Low',
  ideaTypeName: 'Continuous Improvement',
  businessImpactName: 'Critical',
  assignees: [],
  tagNames: [],
  statusId: '3f7b0a3c-1d9e-4a2b-8c55-2f0f9c1d7e41',
  statusName: 'New / Pending',
  upvoteCount: 0,
  hasUpvoted: false,
  commentCount: 4,
  authorUserId: '7edd9249-cc88-46e3-a3e1-354daf717e4f',
  createdAtUtc: '2026-09-04T03:55:41.000Z',
}

const assignee = (firstName: string, lastName: string) => ({
  userId: `${firstName}-${lastName}`.toLowerCase(),
  firstName,
  lastName,
  displayName: `${firstName} ${lastName}`,
  isActive: true,
})

describe('toCurrentUser', () => {
  it('maps the principal every gated component reads', () => {
    expect(toCurrentUser(WIRE_USER, 'Acme Robotics')).toEqual({
      userId: WIRE_USER.userId,
      displayName: 'Olivia Administer',
      initials: 'OA',
      role: 'OrgAdmin',
      roleLabel: 'Org Admin',
      organizationId: WIRE_USER.organizationId,
      organizationName: 'Acme Robotics',
      viewingAs: null,
    })
  })

  it('refuses a role the union does not contain, and names it', () => {
    // Including the near misses, which are the ones that would actually happen: a rename on the
    // API side, or a casing change. A cast would let any of these through to `isAdministrator`,
    // where an unknown role is silently a member.
    for (const role of ['Owner', 'orgadmin', 'ORGADMIN', 'Admin', '']) {
      expect(() => toCurrentUser({ ...WIRE_USER, role }, null)).toThrow(
        `The API returned an unknown role: ${role}`,
      )
    }
  })

  it('carries a View As session without the field the view has no use for', () => {
    // `startedAtUtc` is on the wire and not on `ViewingAs`: the banner counts down to the expiry.
    const viewing = toCurrentUser(
      {
        ...WIRE_USER,
        viewingAs: {
          realUserId: 'demo-site-admin',
          realUserName: 'Sam Deployment',
          startedAtUtc: '2026-09-04T03:00:00.000Z',
          expiresAtUtc: '2026-09-04T04:00:00.000Z',
        },
      },
      'Acme Robotics',
    )
    expect(viewing.viewingAs).toEqual({
      realUserId: 'demo-site-admin',
      realUserName: 'Sam Deployment',
      expiresAtUtc: '2026-09-04T04:00:00.000Z',
    })
  })
})

describe('toIdea', () => {
  it('maps a list item to the card the board renders', () => {
    expect(toIdea(WIRE_IDEA)).toEqual({
      id: WIRE_IDEA.ideaId,
      boardId: WIRE_IDEA.boardId,
      statusId: WIRE_IDEA.statusId,
      statusName: WIRE_IDEA.statusName,
      title: WIRE_IDEA.title,
      priority: 'Low',
      ideaType: 'Continuous Improvement',
      businessImpact: 'Critical',
      tag: null,
      assigneeInitials: null,
      upvotes: 0,
      hasUpvoted: false,
    })
  })

  it('refuses a priority the union does not contain, and names it', () => {
    // The one that fails quietly rather than loudly: `Priority` indexes `PRIORITY_COLORS`, so an
    // `Urgent` the API introduced would reach a card as a dot the colour of `Low`.
    for (const priority of ['Urgent', 'low', 'Highest', '']) {
      expect(() => toIdea({ ...WIRE_IDEA, priority })).toThrow(
        `The API returned an unknown priority: ${priority}`,
      )
    }
  })

  it('takes the first tag and reads no tags as none', () => {
    // `tagNames: []` is the common case in real data and was impossible in the fixture, which is
    // why `tag` is nullable. `[] ?? null` would be `[]`; the index is what makes it null.
    expect(toIdea({ ...WIRE_IDEA, tagNames: [] }).tag).toBeNull()
    expect(toIdea({ ...WIRE_IDEA, tagNames: ['throughput', 'safety'] }).tag).toBe('throughput')
  })

  it('takes the first assignee for the avatar and uppercases the initials', () => {
    expect(
      toIdea({ ...WIRE_IDEA, assignees: [assignee('mia', 'okafor'), assignee('Ravi', 'Patel')] })
        .assigneeInitials,
    ).toBe('MO')
    expect(toIdea({ ...WIRE_IDEA, assignees: [] }).assigneeInitials).toBeNull()
  })
})
