'use client'

import { Alert, Button, EmptyState, TagChip } from '@collega/design-system'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { GatedAction } from '@/components/common/gated-action'
import {
  type Column,
  ConfirmDialog,
  DataTable,
  filterRows,
  type ListConfig,
  ListToolbar,
  MultiSelectFilter,
  Pager,
  pageRows,
  RowActions,
  type Sort,
  sortRows,
  useListState,
} from '@/components/list'
import { deleteTag } from '@/lib/server/tag-actions'
import type { TagOverview } from '@/lib/types'
import { TagDrawer, type TagDrawerMode, type TagUsage } from './tag-drawer'

const CONFIG: ListConfig = {
  filters: ['usage'],
  views: ['list'],
  sortKeys: ['name', 'organization', 'ideas', 'boards', 'created'],
}

const DEFAULT_SORT: Sort = { key: 'name', dir: 'asc' }

const USAGE_OPTIONS = ['Used', 'Unused']

const usageOf = (tag: TagOverview) => (tag.ideaCount > 0 ? 'Used' : 'Unused')
const boardsOf = (tag: TagOverview) => tag.boards.map((board) => board.name).join(', ')

function sortValue(tag: TagOverview, key: string): string | number {
  if (key === 'organization') return tag.organization?.name ?? ''
  if (key === 'ideas') return tag.ideaCount
  if (key === 'boards') return boardsOf(tag)
  if (key === 'created') return tag.createdAtUtc
  return tag.name
}

/** The drawer lives in the URL beside the list: `?tag={id}`, `&mode=edit`, and `?tag=new`. */
function useTagDrawerUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (tag: string | null, mode: 'edit' | null = null) => {
    const next = new URLSearchParams(params)
    next.delete('tag')
    next.delete('mode')
    if (tag) next.set('tag', tag)
    if (mode) next.set('mode', mode)
    const query = next.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
  }
}

/** The page header's action: live for an Org Admin, disabled with its reason for a Site Admin. */
export function AddTagButton({ denial }: { denial: string | null }) {
  const navigate = useTagDrawerUrl()
  return (
    <GatedAction id="why-new-tag" label="Add New Tag" denial={denial}>
      <Button onClick={() => navigate('new')}>Add New Tag</Button>
    </GatedAction>
  )
}

/**
 * Settings → Tags on comp R's list and detail pattern (`20-feature-ideas-and-engagement.md` rules
 * 11–15): List only, the text filter over the name and the Usage filter, sorting and paging in the
 * client, row actions, and the tag drawer. Delete asks first.
 *
 * `denial` null is an Org Admin, who manages; anyone else reaching this screen (a Site Admin, on
 * the cross-organization roll-up) reads only, with Edit and Delete hidden.
 */
export function TagsScreen({
  tags,
  denial,
  usage,
  newColor,
}: {
  tags: TagOverview[]
  denial: string | null
  /** The open tag's ideas, when the drawer is showing one. */
  usage: TagUsage | null
  newColor: string
}) {
  const params = useSearchParams()
  const navigate = useTagDrawerUrl()
  const [state, update] = useListState(CONFIG)
  const [confirming, setConfirming] = useState<TagOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const trigger = useRef<HTMLElement | null>(null)
  const canManage = denial === null
  const rollUp = tags.some((tag) => tag.organization !== null)

  const requested = params.get('tag')
  const open: { mode: TagDrawerMode; tag: TagOverview | null } | null = (() => {
    if (requested === 'new') return canManage ? { mode: 'create', tag: null } : null
    const tag = tags.find((candidate) => candidate.id === requested)
    if (!tag) return null
    return { mode: params.get('mode') === 'edit' && canManage ? 'edit' : 'view', tag }
  })()

  const go = (tag: string | null, mode: 'edit' | null, from?: HTMLElement) => {
    if (from) trigger.current = from
    navigate(tag, mode)
  }

  function ask(tag: TagOverview | null) {
    setError(null)
    setConfirming(tag)
  }

  function confirmDelete() {
    const tag = confirming
    if (!tag) return
    startDelete(async () => {
      const result = await deleteTag(tag.id)
      setError(result.error)
      if (!result.error && open?.tag?.id === tag.id) navigate(null)
      setConfirming(null)
    })
  }

  const columns: Column<TagOverview>[] = [
    {
      key: 'name',
      header: 'Tag',
      cell: (tag) => (
        <button
          type="button"
          onClick={(event) => go(tag.id, null, event.currentTarget)}
          className="rounded-full"
        >
          <TagChip color={tag.color}>{tag.name}</TagChip>
        </button>
      ),
    },
    ...(rollUp
      ? [
          {
            key: 'organization',
            header: 'Organization',
            cell: (tag: TagOverview) => tag.organization?.name,
          },
        ]
      : []),
    { key: 'ideas', header: 'Ideas', numeric: true, cell: (tag) => tag.ideaCount },
    {
      key: 'boards',
      header: 'Boards',
      className: 'max-w-0 w-[34%]',
      cell: (tag) => <span className="block truncate">{boardsOf(tag) || '—'}</span>,
    },
    {
      key: 'created',
      header: 'Created',
      className: 'text-xs leading-snug text-muted-foreground',
      cell: (tag) => (
        <>
          {tag.createdOn}
          {tag.createdBy ? <span className="block">{tag.createdBy}</span> : null}
        </>
      ),
    },
  ]

  const filtered = filterRows(tags, state, (tag) => tag.name, usageOf)
  const sorted = sortRows(filtered, state.sort ?? DEFAULT_SORT, sortValue)
  const page = pageRows(sorted, state.page, state.size)

  const actions = (tag: TagOverview) => (
    <RowActions
      itemLabel={tag.name}
      onView={(from) => go(tag.id, null, from)}
      onEdit={(from) => go(tag.id, 'edit', from)}
      onRemove={() => ask(tag)}
      canEdit={canManage}
      canRemove={canManage}
    />
  )

  const ideas = (n: number) => `${n} ${n === 1 ? 'idea' : 'ideas'}`

  return (
    <>
      {error ? (
        <Alert variant="destructive" role="alert">
          <span>{error}</span>
        </Alert>
      ) : null}

      {tags.length === 0 ? (
        <EmptyState heading="No tags yet">
          A tag is created the first time anyone types it on an idea, or here with Add New Tag.
        </EmptyState>
      ) : (
        <>
          <ListToolbar
            query={state.q}
            onQueryChange={(q) => update({ q })}
            placeholder="Filter by tag…"
          >
            <MultiSelectFilter
              label="Usage"
              options={USAGE_OPTIONS}
              selected={state.filters.usage ?? []}
              onChange={(usage) => update({ filters: { ...state.filters, usage } })}
            />
          </ListToolbar>

          <DataTable
            caption="Tags"
            columns={columns}
            rows={page.rows}
            rowKey={(tag) => tag.id}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            actions={actions}
            selectedKey={open?.tag?.id ?? null}
          />

          <Pager
            page={page.page}
            size={state.size}
            total={sorted.length}
            onPageChange={(n) => update({ page: n })}
            onSizeChange={(size) => update({ size })}
          />
        </>
      )}

      <TagDrawer
        open={open}
        usage={usage}
        newColor={newColor}
        canManage={canManage}
        returnFocusTo={trigger.current}
        onClose={() => go(null, null)}
        onView={(tagId) => go(tagId, null)}
        onEdit={(tagId) => go(tagId, 'edit')}
        onDelete={ask}
      />

      <ConfirmDialog
        open={confirming !== null}
        title="Delete this tag?"
        description={`“${confirming?.name ?? ''}” is removed from ${ideas(confirming?.ideaCount ?? 0)}. Anyone who types it again creates a new tag.`}
        confirmLabel="Delete tag"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => ask(null)}
      />
    </>
  )
}
