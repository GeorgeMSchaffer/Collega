'use client'

import { Alert, Button, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import {
  type Column,
  ConfirmDialog,
  DataTable,
  filterRows,
  type ListConfig,
  ListToolbar,
  Pager,
  pageRows,
  RowActions,
  type Sort,
  sortRows,
  useListState,
} from '@/components/list'
import { Icon } from '@/components/list/icons'
import { deleteGroup } from '@/lib/server/group-actions'
import type { GroupDetail, GroupOverview } from '@/lib/types'
import { GroupDrawer, type GroupPerson } from './group-drawer'

const CONFIG: ListConfig = {
  filters: [],
  views: ['list'],
  sortKeys: ['name', 'members', 'boards'],
}

const DEFAULT_SORT: Sort = { key: 'name', dir: 'asc' }

function sortValue(group: GroupOverview, key: string): string | number {
  if (key === 'members') return group.memberCount
  if (key === 'boards') return group.boardCount
  return group.name.toLowerCase()
}

/** The drawer lives in the URL beside the list: `?group={id}`, and `?group=new`. */
function useGroupDrawerUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (group: string | null) => {
    const next = new URLSearchParams(params)
    next.delete('group')
    if (group) next.set('group', group)
    const query = next.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
  }
}

/** The page header's action: New group for an Org Admin; for anyone else, why they can't. */
export function NewGroupButton({ canManage }: { canManage: boolean }) {
  const navigate = useGroupDrawerUrl()
  if (!canManage) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="lock" className="size-3.5" />
        Only Org Admins can change groups.
      </span>
    )
  }
  return <Button onClick={() => navigate('new')}>New group</Button>
}

/**
 * Settings → Groups (BAG-6a; comp R board access): the organization's groups with their member
 * and board counts, and the group drawer. An Org Admin creates, edits and deletes; everyone else
 * reads, since a board's access list names groups.
 */
export function GroupsScreen({
  groups,
  canManage,
  openGroup,
  people,
}: {
  groups: GroupOverview[]
  canManage: boolean
  /** The open group, read by the page from the URL; null when none is open or it is new. */
  openGroup: GroupDetail | null
  /** The organization's users, for the member picker; empty for a reader who can't manage. */
  people: GroupPerson[]
}) {
  const params = useSearchParams()
  const navigate = useGroupDrawerUrl()
  const [state, update] = useListState(CONFIG)
  const [confirming, setConfirming] = useState<GroupDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const trigger = useRef<HTMLElement | null>(null)

  const requested = params.get('group')
  const open: { isNew: boolean; group: GroupDetail | null } | null =
    requested === 'new'
      ? canManage
        ? { isNew: true, group: null }
        : null
      : openGroup && openGroup.id === requested
        ? { isNew: false, group: openGroup }
        : null

  const go = (group: string | null, from?: HTMLElement) => {
    if (from) trigger.current = from
    navigate(group)
  }

  function confirmDelete() {
    const group = confirming
    if (!group) return
    startDelete(async () => {
      const result = await deleteGroup(group.id)
      setError(result.error)
      if (!result.error) navigate(null)
      setConfirming(null)
    })
  }

  const columns: Column<GroupOverview>[] = [
    {
      key: 'name',
      header: 'Group',
      cell: (group) => (
        <button
          type="button"
          onClick={(event) => go(group.id, event.currentTarget)}
          className="flex items-start gap-2 text-left"
        >
          <span className="mt-0.5 inline-grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon name="group" className="size-3.5" />
          </span>
          <span className="min-w-0">
            <b className="block font-semibold">{group.name}</b>
            {group.description ? (
              <span className="block text-xs text-muted-foreground">{group.description}</span>
            ) : null}
          </span>
        </button>
      ),
    },
    { key: 'members', header: 'Members', numeric: true, cell: (group) => group.memberCount },
    {
      key: 'boards',
      header: 'On boards',
      numeric: true,
      cell: (group) => group.boardCount || '—',
    },
  ]

  const filtered = filterRows(
    groups,
    state,
    (group) => group.name,
    () => [],
  )
  const sorted = sortRows(filtered, state.sort ?? DEFAULT_SORT, sortValue)
  const page = pageRows(sorted, state.page, state.size)

  const boardNames = confirming?.boards.map((board) => board.name) ?? []
  const confirmText =
    boardNames.length > 0
      ? `It is on ${boardNames.join(', ')}. People who see ${
          boardNames.length > 1 ? 'those boards' : 'that board'
        } only through this group lose access. Its members stay in Collega.`
      : 'It is not on any board you can see. Its members stay in Collega.'

  return (
    <>
      {error ? (
        <Alert variant="destructive" role="alert">
          <span>{error}</span>
        </Alert>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState heading="No groups yet">
          {canManage
            ? 'Create one, then add it to a Restricted board.'
            : 'An Org Admin has not created any groups.'}
        </EmptyState>
      ) : (
        <>
          <ListToolbar
            query={state.q}
            onQueryChange={(q) => update({ q })}
            placeholder="Filter by group…"
          />
          <DataTable
            caption="Groups"
            columns={columns}
            rows={page.rows}
            rowKey={(group) => group.id}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            actions={(group) => (
              <RowActions
                itemLabel={group.name}
                onView={(from) => go(group.id, from)}
                canEdit={false}
                canRemove={false}
              />
            )}
            selectedKey={open?.group?.id ?? null}
          />
          <Pager
            page={page.page}
            size={state.size}
            total={sorted.length}
            onPageChange={(n) => update({ page: n })}
            onSizeChange={(size) => update({ size })}
          />
          <p className="m-0 text-xs text-muted-foreground">
            &ldquo;On boards&rdquo; counts only Restricted boards you can see.
          </p>
        </>
      )}

      <GroupDrawer
        open={open}
        canManage={canManage}
        people={people}
        returnFocusTo={trigger.current}
        onClose={() => go(null)}
        onSaved={(groupId) => go(groupId)}
        onDelete={(group) => {
          setError(null)
          setConfirming(group)
        }}
      />

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete ${confirming?.name ?? 'this group'}?`}
        description={confirmText}
        confirmLabel="Delete group"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </>
  )
}
