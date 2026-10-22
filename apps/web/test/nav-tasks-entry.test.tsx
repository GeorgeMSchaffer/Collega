import { describe, expect, it } from 'vitest'
import { allNavItems, navGroupsWith, navItemVisible } from '@/components/nav/nav-items'

/** The Tasks destination (TB-8): in the Workspace group for members, absent for a direct Site Admin. */
const tasks = () => {
  const found = allNavItems.find((item) => item.href === '/tasks')
  if (!found) throw new Error('no Tasks nav item')
  return found
}

describe('the Tasks nav entry', () => {
  it('is labelled Tasks and points at /tasks', () => {
    expect(tasks().label).toBe('Tasks')
  })

  it.each(['OrgAdmin', 'User', 'ReadOnly'] as const)('is offered to %s', (role) => {
    expect(navItemVisible(tasks(), role)).toBe(true)
  })

  it('is hidden from a Site Admin acting directly', () => {
    expect(navItemVisible(tasks(), 'SiteAdmin')).toBe(false)
  })

  it('sits after Ideas in the first group', () => {
    const labels = navGroupsWith({ boards: 0, ideas: 0, backlog: 0 })[0]?.items.map((i) => i.label)
    expect(labels?.indexOf('Tasks')).toBe((labels?.indexOf('Ideas') ?? -2) + 1)
  })
})
