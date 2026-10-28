'use client'

import { Alert, Button, cn } from '@collega/design-system'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { recordUsage } from '@/components/analytics/usage-recorder'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import type { BoardRef, IdeaBlockers, IdeaDetail, IdeaFormOptions, IdeaTasks } from '@/lib/types'
import { AssistChat } from './assist-chat'
import { BlockersSection } from './idea-blockers'
import { IdeaForm, type IdeaFormAssist } from './idea-form'
import { TasksCompletePrompt, TasksSection } from './idea-tasks'
import { type BoardLine, IdeaView } from './idea-view'

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
  boardLine,
  statusColor,
  formOptions,
  createBoards,
  createBoardId,
  assistAvailable = false,
  initial,
  referenceLane,
  effortNeeded,
  tasks,
  blockers,
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
  openedFrom,
}: {
  mode: DrawerMode | null
  idea: IdeaDetail | null
  boardName: string | null
  /** The facts' board line, and Remove from board within it. */
  boardLine: BoardLine | null
  statusColor: string | undefined
  formOptions: IdeaFormOptions | null
  /** Boards a new idea may go on, beside "No board". */
  createBoards: BoardRef[] | null
  createBoardId: string | null
  /** Create opens with the assistant beside the form (rule 32a); false opens the form with a notice. */
  assistAvailable?: boolean
  /** The quick-add row's Title, for the create form to start with. */
  initial?: { title?: string } | undefined
  /** The idea's board has a reference lane, so the form says Effort gates a move. */
  referenceLane?: boolean | undefined
  /** A refused move asks for this Effort: the form opens on it with the message. */
  effortNeeded?: string | undefined
  /** The Tasks section's facts, for a parent in or past a reference lane. */
  tasks?: IdeaTasks | null | undefined
  /** The Blockers section's cards, for a keyed item on a board. */
  blockers?: IdeaBlockers | null | undefined
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
  /** Where an opening came from, for `idea.opened`; an idea already open on first mount came from a link. */
  openedFrom: 'board' | 'list' | 'inbox'
}) {
  const formId = useId()
  const [saving, setSaving] = useState(false)
  // 'chat': assistant and form side by side. 'form': the person chose the form, chat kept. 'failed':
  // a turn failed and the conversation is over.
  const [assist, setAssist] = useState<'chat' | 'form' | 'failed'>('chat')
  const formPane = useRef<HTMLDivElement>(null)
  // The create form's handle, for the assistant's chat to read from and write into.
  const formAssist = useRef<IdeaFormAssist | null>(null)
  // The form's solution list, so the chat's solution chips show what is actually in it.
  const [solutions, setSolutions] = useState<string[]>([])

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
  const assisted = open && mode === 'create' && assistAvailable
  const chatShown = assisted && assist === 'chat'

  // `idea.opened` once per idea opened (`SPEC/20-feature-analytics.md` rule 7). Moving between view
  // and edit of the same idea is not a new opening.
  const openedId = open && mode !== 'create' ? (idea?.id ?? null) : null
  const fromLink = useRef(openedId !== null)
  useEffect(() => {
    if (openedId === null) {
      fromLink.current = false
      return
    }
    recordUsage({
      type: 'idea.opened',
      entityId: openedId,
      props: { source: fromLink.current ? 'link' : openedFrom },
    })
    fromLink.current = false
  }, [openedId, openedFrom])

  // The drawer stays mounted when closed, so each opening starts a new conversation.
  useEffect(() => {
    if (!open) setAssist('chat')
  }, [open])

  const toForm = (to: 'form' | 'failed') => {
    setAssist(to)
    formPane.current?.querySelector<HTMLElement>('[data-error-key="title"]')?.focus()
  }

  // Review and create: validate, and when nothing is missing hand focus to Create idea. It never submits.
  const review = () => {
    if (formAssist.current?.review()) {
      formPane.current?.ownerDocument
        .querySelector<HTMLElement>(`button[type="submit"][form="${CSS.escape(formId)}"]`)
        ?.focus()
    }
  }

  const footer = !open ? null : form ? (
    <>
      <Button type="submit" form={formId} disabled={saving}>
        {saving ? 'Saving…' : mode === 'create' ? 'Create idea' : 'Save changes'}
      </Button>
      <Button variant="outline" onClick={mode === 'create' ? onClose : onView}>
        Cancel
      </Button>
      {assisted && assist === 'form' ? (
        <Button variant="ghost" onClick={() => setAssist('chat')}>
          Use the assistant
        </Button>
      ) : null}
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

  // One element, so the form keeps its values when the chat is hidden or brought back.
  const createForm =
    open && form && formOptions ? (
      // Keyed so switching ideas, or from create to edit, starts from that idea's values.
      <IdeaForm
        key={`${mode}-${idea?.id ?? 'new'}`}
        formId={formId}
        idea={mode === 'edit' ? idea : null}
        options={formOptions}
        boards={mode === 'create' ? createBoards : null}
        boardId={mode === 'create' ? createBoardId : null}
        initial={mode === 'create' ? initial : undefined}
        assistRef={assisted ? formAssist : undefined}
        onSolutionsChange={assisted ? setSolutions : undefined}
        contentLocked={mode === 'edit' && contentLocked}
        referenceLane={referenceLane}
        effortNeeded={mode === 'edit' ? effortNeeded : undefined}
        onSaved={onSaved}
        onPendingChange={setSaving}
      />
    ) : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={mode === 'create' ? 'Add New Idea' : (idea?.title ?? '')}
      footer={footer}
      wide={chatShown}
      bleed={assisted}
      returnFocusTo={returnFocusTo}
    >
      {!open ? null : form && formOptions ? (
        assisted ? (
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-auto',
              'min-[900px]:grid min-[900px]:overflow-hidden',
              chatShown ? 'min-[900px]:grid-cols-[42%_58%]' : 'min-[900px]:grid-cols-1',
            )}
          >
            <AssistChat
              boardId={createBoardId}
              form={formAssist}
              solutions={solutions}
              active={chatShown}
              onManual={() => toForm('form')}
              onReview={review}
              onFailed={() => toForm('failed')}
              className="h-[min(60vh,30rem)] shrink-0 border-b min-[900px]:h-auto min-[900px]:border-r min-[900px]:border-b-0"
            />
            <div
              ref={formPane}
              className="flex flex-col gap-3.5 px-[18px] py-4 min-[900px]:min-h-0 min-[900px]:overflow-auto"
            >
              {assist === 'failed' ? (
                <Notice>
                  AI assist is unavailable right now. Everything captured so far is filled in;
                  finish the idea here.
                </Notice>
              ) : null}
              {createForm}
            </div>
          </div>
        ) : (
          <>
            {mode === 'create' ? (
              <Notice>
                AI assist is unavailable, so fill in the idea here. Everything works the same.
              </Notice>
            ) : null}
            {createForm}
          </>
        )
      ) : idea ? (
        <IdeaView
          idea={idea}
          statusColor={statusColor}
          engagementDenial={engagementDenial}
          followDenial={followDenial}
          boardLine={boardLine}
          tasksPrompt={
            tasks ? (
              <TasksCompletePrompt key={`prompt-${idea.id}`} parent={idea} tasks={tasks} />
            ) : null
          }
          tasks={
            tasks ? <TasksSection key={`tasks-${idea.id}`} parent={idea} tasks={tasks} /> : null
          }
          blockers={
            // A failed board read still shows the chips the idea carries, keys only.
            blockers || idea.blockedBy.length > 0 ? (
              <BlockersSection
                key={`blockers-${idea.id}`}
                item={idea}
                blockers={blockers ?? { candidates: [], cards: {} }}
                canEdit={canEdit && blockers !== null && blockers !== undefined}
              />
            ) : null
          }
        />
      ) : null}
    </Drawer>
  )
}

/** Informational, never an error, and it takes no focus (rule 32c). */
function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert variant="note" role="status" className="flex items-start gap-2">
      <Icon name="info" />
      <span>{children}</span>
    </Alert>
  )
}
