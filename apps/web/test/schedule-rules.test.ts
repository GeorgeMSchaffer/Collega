import { describe, expect, it } from 'vitest'
import {
  mayScheduleTask,
  SCHEDULE_DENIAL,
  type Scheduler,
  scheduleRefusal,
  schedulerFor,
} from '@/lib/roles'

/**
 * Who may put a task in or out of a sprint (TB-10): its author or an Org Admin. An assignee who is
 * neither does not count; Read Only and a direct Site Admin never may.
 */
const ME = 'u-me'
const OTHER = 'u-other'

const schedulerOf = (role: Parameters<typeof schedulerFor>[0]['role']) =>
  schedulerFor({ role, userId: ME })

describe('schedulerFor', () => {
  it('makes an Org Admin an administrator scheduler', () => {
    expect(schedulerOf('OrgAdmin')).toEqual({ userId: ME, isAdmin: true })
  })

  it('makes a User a non-administrator scheduler', () => {
    expect(schedulerOf('User')).toEqual({ userId: ME, isAdmin: false })
  })

  it.each(['ReadOnly', 'SiteAdmin'] as const)('gives %s no scheduler at all', (role) => {
    expect(schedulerOf(role)).toBeNull()
  })
})

describe('mayScheduleTask', () => {
  it('lets an Org Admin schedule any task, authored by anyone or by nobody', () => {
    const admin = schedulerOf('OrgAdmin')
    expect(mayScheduleTask(admin, OTHER)).toBe(true)
    expect(mayScheduleTask(admin, ME)).toBe(true)
    expect(mayScheduleTask(admin, null)).toBe(true)
  })

  it('lets a User schedule a task they wrote', () => {
    expect(mayScheduleTask(schedulerOf('User'), ME)).toBe(true)
  })

  it('refuses a User a task someone else wrote', () => {
    expect(mayScheduleTask(schedulerOf('User'), OTHER)).toBe(false)
  })

  it('refuses a User a task with no author, even though their own id is not null', () => {
    expect(mayScheduleTask(schedulerOf('User'), null)).toBe(false)
  })

  it('does not count being an assignee: only the author id is compared', () => {
    // A task assigned to ME but written by OTHER reaches here as authorUserId OTHER.
    expect(mayScheduleTask(schedulerOf('User'), OTHER)).toBe(false)
  })

  it.each(['ReadOnly', 'SiteAdmin'] as const)(
    'refuses %s every task, their own included',
    (role) => {
      const scheduler = schedulerOf(role)
      expect(mayScheduleTask(scheduler, ME)).toBe(false)
      expect(mayScheduleTask(scheduler, OTHER)).toBe(false)
      expect(mayScheduleTask(scheduler, null)).toBe(false)
    },
  )
})

describe('scheduleRefusal', () => {
  const user: Scheduler = { userId: ME, isAdmin: false }

  it('is null when every task in the selection is editable', () => {
    expect(scheduleRefusal(user, [{ authorUserId: ME }, { authorUserId: ME }])).toBeNull()
  })

  it('gives the denial as soon as one task in the selection is not editable', () => {
    expect(scheduleRefusal(user, [{ authorUserId: ME }, { authorUserId: OTHER }])).toBe(
      SCHEDULE_DENIAL,
    )
  })

  it('treats an empty selection as nothing to refuse', () => {
    expect(scheduleRefusal(user, [])).toBeNull()
  })

  it('is null for an Org Admin whoever wrote the tasks', () => {
    expect(
      scheduleRefusal({ userId: ME, isAdmin: true }, [
        { authorUserId: OTHER },
        { authorUserId: null },
      ]),
    ).toBeNull()
  })

  it('refuses a non-empty selection when there is no scheduler', () => {
    expect(scheduleRefusal(null, [{ authorUserId: ME }])).toBe(SCHEDULE_DENIAL)
  })

  it('names the author and the Org Admin in the reason', () => {
    expect(SCHEDULE_DENIAL).toBe('Only the task’s author or an Org Admin can put it in a sprint.')
  })
})
