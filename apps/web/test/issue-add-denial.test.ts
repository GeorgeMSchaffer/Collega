import { describe, expect, it } from 'vitest'
import { issueAddDenial, mayEditIdeaContent } from '@/lib/roles'

/**
 * Who is offered "Add New Issue" on the Backlog, and who gets a row's Edit
 * (`20-feature-issues-and-delivery.md` "Backlog: add and edit"). Display decisions only: the API
 * refuses the same actions on its own.
 */
describe('issueAddDenial', () => {
  it.each(['User', 'OrgAdmin'] as const)('lets a %s add an Issue', (role) => {
    expect(issueAddDenial(role)).toBeNull()
  })

  it('sends a Site Admin to View As rather than refusing without a way forward', () => {
    expect(issueAddDenial('SiteAdmin')).toBe('Act as a member to add issues. Use View As.')
  })

  it('tells a Read Only member why they cannot add', () => {
    expect(issueAddDenial('ReadOnly')).toBe('Read Only members cannot add issues.')
  })
})

describe('mayEditIdeaContent (the Backlog row Edit)', () => {
  it('lets an Org Admin edit any Issue, authored or not', () => {
    expect(mayEditIdeaContent('OrgAdmin', 'admin-1', 'someone-else')).toBe(true)
    expect(mayEditIdeaContent('OrgAdmin', 'admin-1', null)).toBe(true)
  })

  it('lets a User edit only an Issue they authored', () => {
    expect(mayEditIdeaContent('User', 'user-1', 'user-1')).toBe(true)
    expect(mayEditIdeaContent('User', 'user-1', 'user-2')).toBe(false)
  })

  it('does not let a User edit an Issue with no author', () => {
    expect(mayEditIdeaContent('User', 'user-1', null)).toBe(false)
  })

  it('never lets a Site Admin or a Read Only member edit another member’s Issue', () => {
    expect(mayEditIdeaContent('SiteAdmin', 'sa-1', 'user-2')).toBe(false)
    expect(mayEditIdeaContent('ReadOnly', 'ro-1', 'user-2')).toBe(false)
  })
})
