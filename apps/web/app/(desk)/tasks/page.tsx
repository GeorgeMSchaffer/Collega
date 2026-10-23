import { EmptyState } from '@collega/design-system'
import { PageHeader } from '@/components/common/page-header'
import { Topbar } from '@/components/nav/topbar'
import { TasksTable } from '@/components/tasks/tasks-table'
import { TasksTabs } from '@/components/tasks/tasks-tabs'
import { getOpenSprintsByBoard, getTasks, getWorkBoards, type TaskTab } from '@/lib/data'
import { hasOrgWorkspace, schedulerFor } from '@/lib/roles'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Tasks · Collega' }

const TABS: readonly TaskTab[] = ['backlog', 'mine', 'sprint', 'all']

const EMPTY: Record<TaskTab, { heading: string; text: string }> = {
  backlog: {
    heading: 'Nothing waiting for a sprint',
    text: 'Every task on your work boards is in a sprint or finished.',
  },
  mine: {
    heading: 'No tasks assigned to you',
    text: 'Tasks assigned to you that are not finished appear here.',
  },
  sprint: {
    heading: 'No task is in a sprint',
    text: 'Move tasks from the Backlog tab into a Planned or Active sprint.',
  },
  all: { heading: 'No tasks yet', text: 'Tasks you add to a work board appear here.' },
}

/**
 * Tasks across the organization's work boards (comp W option 2, TB-8). A task is a card on a board
 * that some other board's lane references, so the list is the organization idea list narrowed to
 * those boards. Sprint planning is an Org Admin's; everyone else reads.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  const user = await requireCurrentUser()
  const query = await searchParams
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab
  const tab = TABS.find((candidate) => candidate === requested) ?? 'backlog'

  const header = (
    <>
      <Topbar title={<b>Tasks</b>} />
    </>
  )

  if (!hasOrgWorkspace(user.role)) {
    return (
      <>
        {header}
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <PageHeader title="Tasks" />
          <EmptyState heading="Tasks belong to an organization">
            Use View As to see an organization&rsquo;s tasks as one of its members.
          </EmptyState>
        </main>
      </>
    )
  }

  const boards = await getWorkBoards()
  const sprints = await getOpenSprintsByBoard(boards)
  const [page, backlogCount] = await Promise.all([
    getTasks(tab, boards, sprints),
    tab === 'backlog' ? null : getTasks('backlog', boards, sprints, 1),
  ])
  const scheduler = schedulerFor(user)

  return (
    <>
      {header}
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title="Tasks"
          description={
            scheduler
              ? 'Every task on your work boards. Select tasks from one board to move them into a sprint; you can move the ones you can edit.'
              : 'Every task on your work boards.'
          }
        />
        {boards.length === 0 ? (
          <EmptyState heading="No work boards yet">
            A work board is one that another board&rsquo;s lane references. Set a lane to reference
            a board and its tasks are listed here.
          </EmptyState>
        ) : (
          <>
            <TasksTabs
              active={tab}
              backlogCount={tab === 'backlog' ? page.totalCount : (backlogCount?.totalCount ?? 0)}
            />
            <TasksTable
              key={tab}
              rows={page.ideas}
              total={page.totalCount}
              boards={boards}
              sprints={sprints}
              scheduler={scheduler}
              emptyHeading={EMPTY[tab].heading}
              emptyText={EMPTY[tab].text}
            />
          </>
        )}
      </main>
    </>
  )
}
