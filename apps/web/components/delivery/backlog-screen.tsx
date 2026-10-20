'use client'

import { Avatar, Button, Dot, EffortBar } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type ReactNode, useCallback, useState } from 'react'
import { DRAWER_PARAMS } from '@/components/ideas/idea-list-config'
import { useDrawerUrl } from '@/components/ideas/use-drawer-url'
import {
  type Column,
  DataTable,
  type ListConfig,
  QuickAddBar,
  type QuickAddValues,
  sortRows,
  useListState,
} from '@/components/list'
import { TITLE_MAX_LENGTH } from '@/lib/limits'
import type { DeliveryStatus, Effort, IdeaFormOptions, Issue, Outcome, Sprint } from '@/lib/types'
import { BacklogAdd, type BacklogPrefill, RowEditButton } from './backlog-add'

const CONFIG: ListConfig = {
  views: ['list'],
  sortKeys: ['title', 'outcome', 'effort', 'status', 'assignee', 'votes'],
}

const EFFORT_RANK: Record<Effort, number> = { Low: 1, Medium: 2, High: 3 }

/**
 * The Backlog list on the shared `DataTable` with the quick-add row above it
 * (`20-feature-issues-and-delivery.md` "Backlog: add and edit"). With no sort chosen the rows keep
 * the API's order, most upvoted first. The row hands off: Enter opens the Add New Issue drawer
 * pre-populated with Title, Effort and Sprint, and nothing is created until that form is saved.
 *
 * `editableIds` are the rows the signed-in user may edit (decided on the server by role and
 * authorship); `canAdd` is false for a role that may not add, which hides the row.
 */
export function BacklogScreen({
  rows,
  outcomes,
  statuses,
  sprints,
  editableIds,
  canAdd,
  selectedId,
  options,
  empty,
}: {
  rows: readonly Issue[]
  outcomes: readonly Pick<Outcome, 'id' | 'name' | 'color'>[]
  statuses: readonly Pick<DeliveryStatus, 'id' | 'name'>[]
  /** Non-completed sprints only: the ones an issue can be added to. */
  sprints: readonly Pick<Sprint, 'id' | 'name' | 'state'>[]
  editableIds: readonly string[]
  canAdd: boolean
  selectedId: string | null
  /** Null while the create drawer is closed. */
  options: IdeaFormOptions | null
  /** Shown in place of the table when there are no rows; `BacklogAdd` stays mounted either way. */
  empty: ReactNode
}) {
  const [state, update] = useListState(CONFIG)
  const params = useSearchParams()
  const openDrawer = useDrawerUrl()
  const [prefill, setPrefill] = useState<BacklogPrefill | null>(null)
  const applied = useCallback(() => setPrefill(null), [])

  const outcomeOf = (issue: Issue) => outcomes.find((row) => row.id === issue.outcomeId)
  const statusOf = (issue: Issue) => statuses.find((row) => row.id === issue.deliveryStatusId)

  const sorted = sortRows(rows, state.sort, (issue, key) => {
    if (key === 'outcome') return outcomeOf(issue)?.name ?? ''
    if (key === 'effort') return EFFORT_RANK[issue.effort]
    if (key === 'status') return statusOf(issue)?.name ?? ''
    if (key === 'assignee') return issue.assigneeInitials ?? ''
    if (key === 'votes') return issue.upvotesAtPromotion
    return issue.title
  })

  // The row's link keeps the list's own parameters (sort) and swaps only the drawer's.
  const issueHref = (id: string) => {
    const next = new URLSearchParams(params)
    for (const key of Object.values(DRAWER_PARAMS)) next.delete(key)
    next.set(DRAWER_PARAMS.idea, id)
    return `/delivery/backlog?${next.toString()}` as Route
  }

  const columns: Column<Issue>[] = [
    {
      key: 'title',
      header: 'Issue',
      cell: (issue) => (
        <Link href={issueHref(issue.id)} scroll={false} className="font-semibold hover:underline">
          {issue.title}
        </Link>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      cell: (issue) => {
        const outcome = outcomeOf(issue)
        return outcome ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Dot color={outcome.color} />
            {outcome.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Ungrouped</span>
        )
      },
    },
    {
      key: 'effort',
      header: 'Effort',
      className: 'w-36',
      cell: (issue) => <EffortBar effort={issue.effort} />,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-32 text-muted-foreground',
      cell: (issue) => statusOf(issue)?.name,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      className: 'w-24',
      cell: (issue) =>
        issue.assigneeInitials ? (
          <Avatar initials={issue.assigneeInitials} className="size-6 text-xs" />
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: 'votes',
      header: 'Votes',
      numeric: true,
      className: 'w-28 text-right',
      cell: (issue) => issue.upvotesAtPromotion,
    },
  ]

  const handoff = (values: QuickAddValues) => {
    setPrefill({
      title: values.title ?? '',
      effort: (values.effort as Effort | undefined) ?? '',
      sprintId: values.sprint ?? '',
    })
    openDrawer({ create: true })
  }

  const rowIds = rows.map((row) => row.id).join(',')

  return (
    <>
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="flex flex-col gap-2">
          {rows.length > 1 ? (
            <QuickAddBar
              canAdd={canAdd}
              label="Quick add issue"
              handoff="drawer"
              onHandoff={handoff}
              testId="backlog-quick-add-bar"
              fields={[
                {
                  name: 'title',
                  label: 'Title',
                  required: true,
                  placeholder: 'Add an issue — press Enter for more fields',
                  maxLength: TITLE_MAX_LENGTH,
                },
              ]}
            />
          ) : canAdd ? (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => openDrawer({ create: true })}
            >
              ＋ Add New Issue
            </Button>
          ) : null}
          <DataTable
            caption="Backlog issues"
            columns={columns}
            rows={sorted}
            rowKey={(issue) => issue.id}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            selectedKey={selectedId}
            actions={(issue) =>
              editableIds.includes(issue.id) ? (
                <RowEditButton ideaId={issue.id} title={issue.title} />
              ) : null
            }
          />
          <p className="px-1 text-xs text-muted-foreground">
            {rows.length} issues in the backlog. Vote counts are the snapshot taken at promotion.
          </p>
        </div>
      )}
      <BacklogAdd
        options={options}
        sprints={sprints}
        rowIds={rowIds}
        prefill={prefill}
        onPrefillApplied={applied}
      />
    </>
  )
}
