import { describe, expect, it } from 'vitest'
import { members } from '@/lib/mock'
import { engagementDenial, isAdministrator, type Role, writeDenial } from '@/lib/roles'
import { currentUser, deliveryAdminDenial } from '@/lib/session'
import { actAs } from './support/acting-role'

/**
 * The four-role gating matrix.
 *
 * This has been collapsed three times, always the same way: someone reads "Read Only" and writes a
 * single `canWrite` check, which silently takes voting and commenting away from the one role whose
 * whole purpose is to keep them. Engagement and editing are **separate gates**, and this file is
 * what says so.
 *
 * The table is typed `Record<Role, ...>`, so adding a fifth role fails `tsc` until its row is
 * written. A matrix that quietly ignores a new role would assert nothing about it.
 */
type Expectation = {
  /** May create and edit ideas — `writeDenial`. */
  readonly write: boolean
  /** May vote and comment — `engagementDenial`. These are not the same question. */
  readonly engage: boolean
  /** Reaches the administration routes — `isAdministrator`. */
  readonly administrator: boolean
  /** Reaches the deployment-level routes, which is Site Admin alone. */
  readonly siteAdministrator: boolean
  /** May take an administrator-only delivery action — `deliveryAdminDenial`. */
  readonly deliveryAdmin: boolean
}

const MATRIX: Record<Role, Expectation> = {
  // Outside every organization: cannot author, cannot engage, and cannot administer an
  // organization's delivery either — but still administers the deployment.
  SiteAdmin: {
    write: false,
    engage: false,
    administrator: true,
    siteAdministrator: true,
    deliveryAdmin: false,
  },
  // Everything within their own organization, and nothing at deployment level.
  OrgAdmin: {
    write: true,
    engage: true,
    administrator: true,
    siteAdministrator: false,
    deliveryAdmin: true,
  },
  User: {
    write: true,
    engage: true,
    administrator: false,
    siteAdministrator: false,
    deliveryAdmin: false,
  },
  // Votes and comments; authors and administers nothing.
  ReadOnly: {
    write: false,
    engage: true,
    administrator: false,
    siteAdministrator: false,
    deliveryAdmin: false,
  },
}

const ROLES = Object.keys(MATRIX) as Role[]

describe('the role gating matrix', () => {
  for (const role of ROLES) {
    const expected = MATRIX[role]

    describe(role, () => {
      it(`${expected.write ? 'may' : 'may not'} create or edit an idea`, () => {
        expect(writeDenial(role) === null).toBe(expected.write)
      })

      it(`${expected.engage ? 'may' : 'may not'} vote or comment`, () => {
        expect(engagementDenial(role) === null).toBe(expected.engage)
      })

      it(`${expected.administrator ? 'reaches' : 'is refused'} the administration routes`, () => {
        expect(isAdministrator(role)).toBe(expected.administrator)
      })

      it(`${expected.deliveryAdmin ? 'may' : 'may not'} take an administrator-only delivery action`, () => {
        actAs(role)
        expect(deliveryAdminDenial(role) === null).toBe(expected.deliveryAdmin)
      })
    })
  }

  it('covers every role the type allows', () => {
    expect(ROLES).toEqual(['SiteAdmin', 'OrgAdmin', 'User', 'ReadOnly'])
  })
})

describe('the rules the matrix exists to protect', () => {
  it('lets a Read Only account vote and comment while refusing it a new idea', () => {
    // The exact defect a reviewer caught: one "can write" check would deny both.
    expect(engagementDenial('ReadOnly')).toBeNull()
    expect(writeDenial('ReadOnly')).toBe('Read-only account')
  })

  it('keeps engagement and editing on separate gates', () => {
    // At least one role must disagree between the two, or they have been collapsed into one check.
    const disagreeing = ROLES.filter(
      (role) => (writeDenial(role) === null) !== (engagementDenial(role) === null),
    )
    expect(disagreeing).toEqual(['ReadOnly'])
  })

  it('refuses a Site Admin both engagement and authorship, being outside the organization', () => {
    expect(writeDenial('SiteAdmin')).toBe('Act as a member')
    expect(engagementDenial('SiteAdmin')).toBe('Not a member of this organization')
  })

  it('still treats a Site Admin as an administrator for the settings routes', () => {
    // Denied every member action and granted every administrator one is not a contradiction: the
    // two gates answer different questions, which is why one boolean cannot serve both.
    expect(writeDenial('SiteAdmin')).not.toBeNull()
    expect(isAdministrator('SiteAdmin')).toBe(true)
  })

  it('separates administering the deployment from administering an organization', () => {
    // A Site Admin reaches the settings routes and is still refused a sprint action. Both are
    // "administrator" questions with opposite answers, which is why one flag cannot serve both.
    actAs('SiteAdmin')
    expect(isAdministrator('SiteAdmin')).toBe(true)
    expect(deliveryAdminDenial('SiteAdmin')).not.toBeNull()
  })

  it('makes an Org Admin an administrator without making them a Site Admin', () => {
    expect(isAdministrator('OrgAdmin')).toBe(true)
    expect(MATRIX.OrgAdmin.siteAdministrator).toBe(false)
  })

  it('gives a member and a Site Admin different reasons for the same delivery refusal', () => {
    // A Site Admin is offered the route back through View As; a member is told the scope. Wording
    // them alike would tell a Site Admin an action exists nowhere, which is false.
    actAs('SiteAdmin')
    const siteAdmin = deliveryAdminDenial('SiteAdmin')
    actAs('User')
    const member = deliveryAdminDenial('User')

    expect(member).toBe('Administrators only')
    expect(siteAdmin).not.toBeNull()
    expect(siteAdmin).not.toBe(member)
  })
})

describe('the premise the role fixtures rest on', () => {
  it('seeds no Site Admin into any organization', () => {
    // A Site Admin belongs to no organization, which is why the test identity carries a null
    // organizationName. If the seed ever grows one, that fixture is wrong and this fails first.
    expect(members.filter((member) => member.role === 'SiteAdmin')).toEqual([])
  })

  it('signs in as an Org Admin of a named organization by default', () => {
    expect(currentUser().role).toBe('OrgAdmin')
    expect(currentUser().organizationName).toBe('Acme Robotics')
  })

  it('gives a Site Admin no organization name to display', () => {
    actAs('SiteAdmin')
    expect(currentUser().organizationName).toBeNull()
    expect(currentUser().organizationId).toBeNull()
  })
})
