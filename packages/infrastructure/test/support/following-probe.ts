// A throwaway organization for the live-database following and inbox suites: users, one status,
// one board and ideas, all under one organization id so `remove()` takes everything back out.
// Ids come from `randomUUID` because they only have to be unique, not stable; the clock is a
// constant and no assertion depends on the wall clock.

import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '../../src/generated/prisma/index.js'

export const PROBE_CREATED = new Date('2026-09-20T09:00:00.000Z')
const stamps = { created_at_utc: PROBE_CREATED, updated_at_utc: PROBE_CREATED }

export type ProbeOrg = ReturnType<typeof probeOrg>

export function probeOrg(prisma: PrismaClient) {
  const marker = randomUUID()
  const organizationId = randomUUID()
  const boardId = randomUUID()
  const statusId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()

  async function newUser(label: string, status: 'Active' | 'Inactive' = 'Active'): Promise<string> {
    const id = randomUUID()
    await prisma.users.create({
      data: {
        id,
        organization_id: organizationId,
        first_name: label,
        last_name: 'Probe',
        email: `${label}-${id}@example.test`,
        normalized_email: `${label}-${id}@EXAMPLE.TEST`.toUpperCase(),
        password_hash: 'not-a-real-hash',
        role: 'User',
        status,
        must_change_password: false,
        failed_login_count: 0,
        security_stamp: marker,
        ...stamps,
      },
    })
    return id
  }

  async function newIdea(authorUserId: string, options: { isDeleted?: boolean } = {}) {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        status_id: statusId,
        title: `Probe idea ${id}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: authorUserId,
        is_deleted: options.isDeleted ?? false,
        phase: 'Discovery',
        ...stamps,
      },
    })
    return id
  }

  return {
    organizationId,
    boardId,
    statusId,
    newUser,
    newIdea,

    async setUp(): Promise<void> {
      await prisma.organizations.create({
        data: {
          id: organizationId,
          title: `probe-org-${marker}`,
          description: 'Following probe.',
          invite_code: `probe-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
      await prisma.statuses.create({
        data: {
          id: statusId,
          organization_id: organizationId,
          name: 'New',
          color: '#123456',
          sort_order: 0,
          is_deleted: false,
          ...stamps,
        },
      })
      await prisma.idea_types.create({
        data: {
          id: ideaTypeId,
          organization_id: organizationId,
          name: 'Probe type',
          sort_order: 0,
          is_deleted: false,
          ...stamps,
        },
      })
      await prisma.business_impacts.create({
        data: {
          id: impactId,
          organization_id: organizationId,
          name: 'Probe impact',
          color: '#123456',
          sort_order: 0,
          is_deleted: false,
          ...stamps,
        },
      })
      await prisma.boards.create({
        data: {
          id: boardId,
          organization_id: organizationId,
          name: `Probe board ${marker}`,
          allow_user_status_update: false,
          ...stamps,
          board_swimlanes: {
            create: [{ id: randomUUID(), status_id: statusId, display_order: 0 }],
          },
        },
      })
    },

    async remove(): Promise<void> {
      // Followers cascade from ideas; notification rows have no foreign key, so clear them by
      // organization.
      await prisma.notification_events.deleteMany({ where: { organization_id: organizationId } })
      await prisma.audit_events.deleteMany({ where: { organization_id: organizationId } })
      await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
      await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
      await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
      await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
      await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
      await prisma.users.deleteMany({ where: { organization_id: organizationId } })
      await prisma.organizations.deleteMany({ where: { id: organizationId } })
    },
  }
}
