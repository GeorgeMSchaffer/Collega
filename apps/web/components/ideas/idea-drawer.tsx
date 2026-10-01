'use client'

import { Button } from '@collega/design-system'
import { useId, useState } from 'react'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import type { BoardRef, IdeaDetail, IdeaFormOptions } from '@/lib/types'
import { IdeaForm } from './idea-form'
import { IdeaView } from './idea-view'

export type DrawerMode = 'view' | 'edit' | 'create'

/**
 * The idea drawer (comp R), replacing the docked inspector: over the page, never beside it, so the
 * list or lanes beneath keep their width. Its mode and idea come from the URL (`DRAWER_PARAMS`),
 * read on the server, so a deep link opens it and back/forward walk it.
 *
 * What the reader may do arrives decided: `canEdit` and `canDelete` already fold in the role and an
 * archived board, and `contentLocked` is rule 2a. Nothing here re-derives them.
 */
export function IdeaDrawer({
  mode,
  idea,
  boardName,
  statusColor,
  formOptions,
  createBoards,
  createBoardId,
  canEdit,
  canDelete,
  contentLocked,
  engagementDenial,
  followDenial,
  returnFocusTo,
  onEdit,
  onView,
  onClose,
  onDelete,
  onSaved,
}: {
  mode: DrawerMode | null
  idea: IdeaDetail | null
  boardName: string | null
  statusColor: string | undefined
  formOptions: IdeaFormOptions | null
  /** Boards a new idea may go on, when none is in context (Ideas); null on a board's page. */
  createBoards: BoardRef[] | null
  createBoardId: string | null
  canEdit: boolean
  canDelete: boolean
  contentLocked: boolean
  engagementDenial: string | null
  followDenial: string | null
  returnFocusTo: HTMLElement | null
  onEdit: () => void
  onView: () => void
  onClose: () => void
  onDelete: (trigger: HTMLElement) => void
  onSaved: (ideaId: string) => void
}) {
  const formId = useId()
  const [saving, setSaving] = useState(false)

  const open =
    (mode === 'create' && formOptions !== null) ||
    (mode === 'view' && idea !== null) ||
    (mode === 'edit' && idea !== null && formOptions !== null)

  const eyebrow =
    mode === 'create'
      ? `New idea${createBoardId && boardName ? ` · ${boardName}` : ''}`
      : mode === 'edit'
        ? `Edit · ${boardName ?? ''}`
        : idea
          ? `${boardName ?? ''} · ${idea.statusName}`
          : null

  const form = mode === 'create' || mode === 'edit'

  const footer = !open ? null : form ? (
    <>
      <Button type="submit" form={formId} disabled={saving}>
        {saving ? 'Saving…' : mode === 'create' ? 'Create idea' : 'Save changes'}
      </Button>
      <Button variant="outline" onClick={mode === 'create' ? onClose : onView}>
        Cancel
      </Button>
    </>
  ) : canEdit || canDelete ? (
    <>
      {canEdit ? (
        <Button onClick={onEdit}>
          <Icon name="edit" />
          Edit
        </Button>
      ) : null}
      <span className="flex-1" />
      {canDelete ? (
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={(event) => onDelete(event.currentTarget)}
        >
          <Icon name="trash" />
          Delete
        </Button>
      ) : null}
    </>
  ) : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={mode === 'create' ? 'Add New Idea' : (idea?.title ?? '')}
      footer={footer}
      returnFocusTo={returnFocusTo}
    >
      {!open ? null : form && formOptions ? (
        // Keyed so switching ideas, or from create to edit, starts from that idea's values.
        <IdeaForm
          key={`${mode}-${idea?.id ?? 'new'}`}
          formId={formId}
          idea={mode === 'edit' ? idea : null}
          options={formOptions}
          boards={mode === 'create' ? createBoards : null}
          boardId={mode === 'create' ? createBoardId : null}
          contentLocked={mode === 'edit' && contentLocked}
          onSaved={onSaved}
          onPendingChange={setSaving}
        />
      ) : idea ? (
        <IdeaView
          idea={idea}
          statusColor={statusColor}
          engagementDenial={engagementDenial}
          followDenial={followDenial}
        />
      ) : null}
    </Drawer>
  )
}
