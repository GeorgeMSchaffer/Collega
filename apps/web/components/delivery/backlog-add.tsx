'use client'

import { Button } from '@collega/design-system'
import { useEffect, useId, useState } from 'react'
import { IdeaForm } from '@/components/ideas/idea-form'
import { useDrawerUrl } from '@/components/ideas/use-drawer-url'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import type { IdeaFormOptions, Sprint } from '@/lib/types'
import { useToast } from './toast'

/**
 * The Backlog's creation action (`20-feature-issues-and-delivery.md` "Backlog: add and edit"). The
 * page renders it live for a role that may add and as a `GatedAction` with the reason otherwise.
 */
export function AddIssueButton({ label = 'Add New Issue' }: { label?: string }) {
  const openDrawer = useDrawerUrl()
  return (
    <Button onClick={() => openDrawer({ create: true })}>
      <Icon name="plus" />
      {label}
    </Button>
  )
}

/** A Backlog row's Edit: the Issue drawer's edit form. The page leaves it out for a role that may not edit. */
export function RowEditButton({ ideaId, title }: { ideaId: string; title: string }) {
  const openDrawer = useDrawerUrl()
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Edit ${title}`}
      onClick={() => openDrawer({ edit: ideaId })}
    >
      Edit
    </Button>
  )
}

/**
 * The create drawer (comp A): the idea form with Effort and Sprint and no Board or Status, open
 * while `?new` is in the URL. On success it switches to the new Issue in view mode and confirms
 * with a toast; an Issue that landed on the Backlog is scrolled into view and highlighted, since
 * with no votes it sorts last.
 *
 * `options` is null while the drawer is closed (the page reads the catalogs only when asked), and
 * `rowIds` is the Backlog's current rows, which is how the effect learns the refreshed list has
 * the new one in it.
 */
export function BacklogAdd({
  options,
  sprints,
  rowIds,
}: {
  options: IdeaFormOptions | null
  /** Non-completed sprints only. */
  sprints: readonly Pick<Sprint, 'id' | 'name' | 'state'>[]
  rowIds: string
}) {
  const openDrawer = useDrawerUrl()
  const formId = useId()
  const [saving, setSaving] = useState(false)
  const [toast, showToast] = useToast()
  const [added, setAdded] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: rowIds is the trigger — the row exists only once the refreshed list arrives.
  useEffect(() => {
    if (!added) return
    const row = document.querySelector<HTMLElement>(`[data-issue-id="${CSS.escape(added)}"]`)
    if (!row) return
    row.scrollIntoView({ block: 'nearest' })
    row.dataset.added = ''
    const timer = setTimeout(() => {
      delete row.dataset.added
      setAdded(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
      delete row.dataset.added
    }
  }, [added, rowIds])

  const saved = (ideaId: string, sprintId?: string) => {
    const sprint = sprints.find((candidate) => candidate.id === sprintId)
    showToast(sprint ? `Issue added to ${sprint.name}` : 'Issue added')
    // Only a Backlog row has a place in this list to be found.
    setAdded(sprint ? null : ideaId)
    openDrawer({ view: ideaId })
  }

  return (
    <>
      <Drawer
        open={options !== null}
        onClose={() => openDrawer(null)}
        eyebrow="New issue"
        title="Add New Issue"
        footer={
          <>
            <Button type="submit" form={formId} disabled={saving}>
              {saving ? 'Adding issue…' : 'Add issue'}
            </Button>
            <Button variant="outline" onClick={() => openDrawer(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {options ? (
          <IdeaForm
            formId={formId}
            idea={null}
            options={options}
            boards={null}
            boardId={null}
            contentLocked={false}
            addingIssue={{ sprints }}
            onSaved={saved}
            onPendingChange={setSaving}
          />
        ) : null}
      </Drawer>
      {toast}
    </>
  )
}
