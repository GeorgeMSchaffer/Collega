import { DEFAULT_BUSINESS_IMPACTS, DEFAULT_IDEA_TYPES } from '@collega/application/organizations'
import { TAG_COLOR_PALETTE } from '@collega/domain/tags'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SeedModule } from '../types.js'
import {
  autoCreatedTaskKeys,
  type DemoReferenceScenario,
  type DemoTask,
  REFERENCE_SCENARIOS,
  SPRINT_STATES,
  SPRINT_WINDOWS,
  validateReferenceScenario,
  type WorkLane,
} from './references-scenario.js'
import {
  CONTRIBUTOR_LOCAL_PARTS,
  DEMO_ORGANIZATIONS,
  type DemoBoardScenario,
  seedId,
} from './scenario.js'

/**
 * Board References, Outcomes and per-board sprints, seeded onto the three vertical organizations
 * (Acme and Blue Harbor stay as the golden corpus and the E2E suite pin them).
 *
 * Each vertical gets a work board that its `Opportunities` board's In Progress lane references,
 * with tasks (child cards) in varied lanes and sprints, a few blocked-by links, Effort on the
 * parents, Outcomes over the top-level items and metric values that the Outcomes total.
 *
 * **Rows are written, not created through the services**, as `delivery.ts` does for promotion; the
 * rules the services enforce are checked on the scenario data by `validateReferenceScenario`, and
 * the shape of a task row follows `IdeaService.stageBoardTask` (the organization's first idea type
 * and business impact, the title standing in for the NOT NULL text columns, the author and
 * assignees following). The reference lane is set to Auto-create tasks and the first task of each parent is
 * flagged `auto_created`, as entering that lane would have made it; the rest are hand-added.
 */

const WORK_LANES: readonly WorkLane[] = ['todo', 'doing', 'review', 'done']
const LANE_STATUS: Record<WorkLane, string> = {
  todo: 'New / Pending',
  doing: 'In Progress',
  review: 'In Review',
  done: 'Complete',
}
const REFERENCE_STATUS = 'In Progress'
const FINAL_STATUS = 'Complete'

/** A whole day, matching the schema's `@db.Date`. */
function dayUtc(base: Date, offsetDays: number): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offsetDays),
  )
}

/** First day of the quarter `offset` quarters from the one containing `base`. */
function quarterStart(base: Date, offset: number): Date {
  const quarter = Math.floor(base.getUTCMonth() / 3)
  return new Date(Date.UTC(base.getUTCFullYear(), (quarter + offset) * 3, 1))
}

/** Last day of that quarter. */
function quarterEnd(base: Date, offset: number): Date {
  return dayUtc(quarterStart(base, offset + 1), -1)
}

export const boardReferencesSeed: SeedModule = {
  name: 'board-references',
  // Delivery runs first: it promotes ideas on the first board, and this module only adds around them.
  dependsOn: ['delivery'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()
    for (const reference of REFERENCE_SCENARIOS) {
      validateReferenceScenario(reference)
      await seedOrganization(prisma, reference, now)
    }
  },
}

async function seedOrganization(
  prisma: PrismaClient,
  reference: DemoReferenceScenario,
  now: Date,
): Promise<void> {
  const scenario = DEMO_ORGANIZATIONS.find((candidate) => candidate.slug === reference.slug)
  const ideasBoard = scenario?.boards[0]
  const oppsBoard = scenario?.boards[1]
  if (scenario === undefined || ideasBoard === undefined || oppsBoard === undefined) {
    throw new Error(`The references seed needs two boards on '${reference.slug}'.`)
  }
  const slug = scenario.slug
  const organizationId = seedId('organization', slug)
  const contributorIds = CONTRIBUTOR_LOCAL_PARTS.map((localPart) => seedId('user', slug, localPart))
  const owner = contributorIds[0] as string
  const statusId = (name: string) => seedId('status', slug, name)

  // ---- boards and lanes --------------------------------------------------------------------
  const ideasBoardId = seedId('board', slug, ideasBoard.name)
  const oppsBoardId = seedId('board', slug, oppsBoard.name)
  const workBoardId = seedId('board', slug, reference.workBoard.name)

  // A target of a reference keeps idea features off (the services turn them off on first
  // reference), and sprints are on so it can hold them.
  await prisma.boards.upsert({
    where: { id: workBoardId },
    update: {},
    create: {
      id: workBoardId,
      organization_id: organizationId,
      name: reference.workBoard.name,
      description: reference.workBoard.description,
      key_prefix: reference.workBoard.keyPrefix,
      allow_user_status_update: true,
      sprints_enabled: true,
      idea_features_enabled: false,
      created_at_utc: now,
      updated_at_utc: now,
      created_by_user_id: owner,
      updated_by_user_id: owner,
    },
  })
  for (const [index, lane] of WORK_LANES.entries()) {
    await prisma.board_swimlanes.upsert({
      where: {
        board_id_status_id: { board_id: workBoardId, status_id: statusId(LANE_STATUS[lane]) },
      },
      update: {},
      create: {
        id: seedId('swimlane', slug, reference.workBoard.name, LANE_STATUS[lane]),
        board_id: workBoardId,
        status_id: statusId(LANE_STATUS[lane]),
        display_order: index,
        is_final: lane === 'done',
      },
    })
  }

  // The existing lanes are updated in place: Complete is final on both boards, and the second
  // board's In Progress lane references the work board.
  await prisma.board_swimlanes.updateMany({
    where: { board_id: { in: [ideasBoardId, oppsBoardId] }, status_id: statusId(FINAL_STATUS) },
    data: { is_final: true },
  })
  await prisma.board_swimlanes.updateMany({
    where: { board_id: oppsBoardId, status_id: statusId(REFERENCE_STATUS) },
    data: { references_board_id: workBoardId, auto_create_task: true },
  })

  const ideaId = (board: DemoBoardScenario, index: number): string => {
    const title = board.ideas?.[index]?.title
    if (title === undefined)
      throw new Error(`'${slug}' board '${board.name}' has no idea ${index}.`)
    return seedId('idea', slug, board.name, title)
  }
  const taskId = (key: string) => seedId('idea', slug, reference.workBoard.name, `task:${key}`)
  const resolve = (ref: string): string => {
    const [kind, rest] = ref.split(':') as [string, string]
    if (kind === 'ideas') return ideaId(ideasBoard, Number(rest))
    if (kind === 'opps') return ideaId(oppsBoard, Number(rest))
    return taskId(rest)
  }

  // ---- parents: moved into the lane, Effort set ---------------------------------------------
  for (const parent of reference.parents) {
    const id = ideaId(oppsBoard, parent.idea)
    if (parent.inLane) {
      await prisma.ideas.update({
        where: { id },
        data: { status_id: statusId(REFERENCE_STATUS), updated_at_utc: now },
      })
    }
    await prisma.ideas.updateMany({
      where: { id, effort: null },
      data: { effort: parent.effort },
    })
  }
  for (const [ref, effort] of Object.entries(reference.otherEfforts)) {
    await prisma.ideas.updateMany({ where: { id: resolve(ref), effort: null }, data: { effort } })
  }

  // ---- sprints on the work board ------------------------------------------------------------
  const sprintId = (n: number) => seedId('sprint', slug, reference.workBoard.name, String(n))
  for (const [index, sprint] of reference.sprints.entries()) {
    const [start, end] = SPRINT_WINDOWS[index] as readonly [number, number]
    await prisma.sprints.upsert({
      where: { id: sprintId(index + 1) },
      update: {},
      create: {
        id: sprintId(index + 1),
        organization_id: organizationId,
        board_id: workBoardId,
        name: sprint.name,
        goal: sprint.goal,
        start_date: dayUtc(now, start),
        end_date: dayUtc(now, end),
        owner_user_id: owner,
        state: SPRINT_STATES[index] as (typeof SPRINT_STATES)[number],
        is_deleted: false,
        created_at_utc: now,
        updated_at_utc: now,
        created_by_user_id: owner,
        updated_by_user_id: owner,
      },
    })
  }

  // ---- tasks: parents' first, then standalone cards -----------------------------------------
  const defaultType = DEFAULT_IDEA_TYPES[0]
  const defaultImpact = DEFAULT_BUSINESS_IMPACTS[0]
  if (defaultType === undefined || defaultImpact === undefined) {
    throw new Error('The organization defaults list no idea type or business impact.')
  }
  const tagRows = await prisma.tags.findMany({
    where: { organization_id: organizationId },
    select: { id: true, normalized_name: true },
  })
  const tagIdFor = (name: string): string => {
    const tag = tagRows.find((row) => row.normalized_name === name.toLowerCase())
    if (tag === undefined) throw new Error(`'${slug}' has no tag '${name}'.`)
    return tag.id
  }

  const tasks: { task: DemoTask; parentId: string | null }[] = [
    ...reference.parents.flatMap((parent) =>
      parent.tasks.map((task) => ({
        task,
        parentId: ideaId(oppsBoard, parent.idea) as string | null,
      })),
    ),
    ...reference.cards.map((task) => ({ task, parentId: null })),
  ]

  const autoCreated = autoCreatedTaskKeys(reference)

  // Insert-if-missing in batches: a row that exists is left as it is, as the upserts elsewhere do.
  const ideaRows = []
  const assigneeRows = []
  const followerRows = []
  const tagLinkRows = []
  for (const [index, { task, parentId }] of tasks.entries()) {
    const id = taskId(task.key)
    // Seconds apart and in list order, so the Tasks section and the lanes read in creation order.
    const createdAt = new Date(now.getTime() - (tasks.length - index) * 5_000)
    const author = contributorIds[index % contributorIds.length] as string
    const assignees = (task.assignees ?? []).map((i) => contributorIds[i] as string)

    ideaRows.push({
      id,
      organization_id: organizationId,
      board_id: workBoardId,
      parent_idea_id: parentId,
      auto_created: autoCreated.has(task.key),
      item_number: index + 1,
      status_id: statusId(LANE_STATUS[task.lane]),
      sprint_id: task.sprint === undefined ? null : sprintId(task.sprint),
      title: task.title,
      description: null,
      problem: task.title,
      proposed_solutions: [task.title],
      impact_rationale: task.title,
      priority: 'Medium' as const,
      idea_type_id: seedId('idea-type', slug, defaultType.name),
      business_impact_id: seedId('business-impact', slug, defaultImpact.name),
      author_user_id: author,
      is_deleted: false,
      created_at_utc: createdAt,
      updated_at_utc: createdAt,
    })
    for (const userId of assignees) {
      assigneeRows.push({ id: seedId('assignee', id, userId), idea_id: id, user_id: userId })
    }
    for (const userId of new Set([author, ...assignees])) {
      followerRows.push({
        id: seedId('follower', id, userId),
        idea_id: id,
        user_id: userId,
        created_at_utc: createdAt,
      })
    }
    if (task.tag !== undefined) {
      const tagId = tagIdFor(task.tag)
      tagLinkRows.push({ id: seedId('idea-tag', id, tagId), idea_id: id, tag_id: tagId })
    }
  }
  await prisma.ideas.createMany({ data: ideaRows, skipDuplicates: true })
  await prisma.idea_assignees.createMany({ data: assigneeRows, skipDuplicates: true })
  await prisma.idea_followers.createMany({ data: followerRows, skipDuplicates: true })
  await prisma.idea_tags.createMany({ data: tagLinkRows, skipDuplicates: true })
  await prisma.boards.updateMany({
    where: { id: workBoardId, next_item_number: { lte: tasks.length } },
    data: { next_item_number: tasks.length + 1 },
  })

  await prisma.idea_dependencies.createMany({
    data: tasks.flatMap(({ task }) =>
      (task.blockedBy ?? []).map((blockerKey) => ({
        blocked_idea_id: taskId(task.key),
        blocker_idea_id: taskId(blockerKey),
        created_at_utc: now,
      })),
    ),
    skipDuplicates: true,
  })

  // ---- metric types and values --------------------------------------------------------------
  const metricId = (key: string) => seedId('metric-type', slug, key)
  for (const type of reference.metricTypes) {
    await prisma.metric_types.upsert({
      where: { metric_type_id: metricId(type.key) },
      update: {},
      create: {
        metric_type_id: metricId(type.key),
        organization_id: organizationId,
        name: type.name,
        unit: type.unit,
        is_archived: type.archived === true,
        created_at_utc: now,
        updated_at_utc: now,
      },
    })
  }
  await prisma.idea_metric_values.createMany({
    data: reference.metricValues.map((value) => ({
      idea_id: resolve(value.item),
      metric_type_id: metricId(value.metric),
      projected: value.projected ?? null,
      realized: value.realized ?? null,
    })),
    skipDuplicates: true,
  })

  // ---- outcomes ------------------------------------------------------------------------------
  for (const [index, outcome] of reference.outcomes.entries()) {
    const id = seedId('outcome', slug, outcome.key)
    await prisma.outcomes.upsert({
      where: { id },
      update: {},
      create: {
        id,
        organization_id: organizationId,
        name: outcome.name,
        description: outcome.description,
        target_start_date: quarterStart(now, outcome.startQuarter),
        target_end_date: quarterEnd(now, outcome.endQuarter),
        owner_user_id: contributorIds[outcome.owner] as string,
        sort_order: index,
        color: (TAG_COLOR_PALETTE[outcome.color] as string).toUpperCase(),
        is_deleted: false,
        created_at_utc: now,
        updated_at_utc: now,
        created_by_user_id: owner,
        updated_by_user_id: owner,
      },
    })
    // Only items not yet grouped, so a regroup done while exploring survives a re-run.
    for (const item of outcome.items) {
      await prisma.ideas.updateMany({
        where: { id: resolve(item), outcome_id: null },
        data: { outcome_id: id },
      })
    }
  }
}
