import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadAccessSetup,
  loadBoardAccess,
  loadNewBoardAccess,
} from '@/components/access/load-access-setup'
import type { BoardOverview, BoardWithLanes } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * What the Access section is handed: an Org Admin reads `/users` (roles, so a head count), a User
 * creating a board reads `/members` (no roles, so none), and an edit gets a setup only when the
 * board read says the caller may manage access. The data seam is the boundary.
 */
const data = vi.hoisted(() => ({
  getGroupsWithMembers: vi.fn(),
  getMemberOptions: vi.fn(),
  getMembersForOrganization: vi.fn(),
}))
vi.mock('@/lib/data', () => data)

beforeEach(() => {
  data.getGroupsWithMembers.mockReset().mockResolvedValue([
    {
      id: 'g-1',
      name: 'Core team',
      members: [
        { id: 'u-1', active: true },
        { id: 'u-2', active: false },
      ],
    },
  ])
  data.getMemberOptions
    .mockReset()
    .mockResolvedValue([{ id: 'u-1', name: 'Zed Last' }, { id: 'u-2', name: 'Abe First' }])
  data.getMembersForOrganization.mockReset().mockResolvedValue([
    { id: 'u-1', displayName: 'Zed Last', role: 'User', status: 'Active' },
    { id: 'u-2', displayName: 'Abe First', role: 'OrgAdmin', status: 'Deactivated' },
  ])
})

const OPEN = { restricted: false, userIds: [], groupIds: [], creator: null }

describe('loadAccessSetup', () => {
  it('gives an Org Admin people with roles and status, sorted by name', async () => {
    actAs('OrgAdmin')
    const setup = await loadAccessSetup(OPEN)
    expect(setup.people).toEqual([
      { id: 'u-2', name: 'Abe First', role: 'OrgAdmin', active: false },
      { id: 'u-1', name: 'Zed Last', role: 'User', active: true },
    ])
    expect(data.getMemberOptions).not.toHaveBeenCalled()
  })

  it('gives a User people with no roles, read from /members, so no head count follows', async () => {
    actAs('User')
    const setup = await loadAccessSetup(OPEN)
    expect(setup.people.map((person) => person.role)).toEqual([null, null])
    expect(setup.people.every((person) => person.active)).toBe(true)
    expect(data.getMembersForOrganization).not.toHaveBeenCalled()
  })

  it('counts every member of a group but lists only the active ones as able to see', async () => {
    actAs('OrgAdmin')
    const setup = await loadAccessSetup(OPEN)
    expect(setup.groups).toEqual([
      { id: 'g-1', name: 'Core team', memberIds: ['u-1'], memberCount: 2 },
    ])
  })
})

describe('loadNewBoardAccess', () => {
  it('is open to everyone, with the reader as creator', async () => {
    actAs('User')
    const setup = await loadNewBoardAccess()
    expect(setup).toMatchObject({
      restricted: false,
      userIds: [],
      groupIds: [],
      organizationName: 'Acme Robotics',
    })
    expect(setup.creator?.id).toBe(setup.readerId)
  })
})

describe('loadBoardAccess', () => {
  const board = (over: Partial<BoardWithLanes> = {}) =>
    ({
      restricted: true,
      accessUserIds: ['u-1'],
      accessGroupIds: ['g-1'],
      canManageAccess: true,
      ...over,
    }) as BoardWithLanes
  const overview = { createdById: 'u-9', createdBy: 'Cora Creator' } as BoardOverview

  it('returns nothing, and reads nothing, when the caller may not manage access', () => {
    actAs('User')
    expect(loadBoardAccess(board({ canManageAccess: false }), overview)).toBeUndefined()
    expect(data.getGroupsWithMembers).not.toHaveBeenCalled()
  })

  it('seeds the stored list and names the creator from the list item', async () => {
    actAs('OrgAdmin')
    const setup = await loadBoardAccess(board(), overview)
    expect(setup).toMatchObject({
      restricted: true,
      userIds: ['u-1'],
      groupIds: ['g-1'],
      creator: { id: 'u-9', name: 'Cora Creator' },
    })
  })

  it('has no creator when the board is not on the list', async () => {
    actAs('OrgAdmin')
    const setup = await loadBoardAccess(board(), undefined)
    expect(setup?.creator).toBeNull()
  })
})
