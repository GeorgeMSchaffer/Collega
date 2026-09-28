'use client'

import {
  Alert,
  Button,
  ColorPicker,
  Field,
  Input,
  Label,
  Meta,
  TagChip,
} from '@collega/design-system'
import Link from 'next/link'
import { type ReactNode, useActionState, useState } from 'react'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { saveTag, type TagFormState } from '@/lib/server/tag-actions'
import type { TagOverview } from '@/lib/types'

export type TagDrawerMode = 'view' | 'edit' | 'create'

/** The ideas carrying the open tag, read by the page from the ideas list's `tag` filter. */
export type TagUsage = { ideas: { id: string; title: string; boardId: string }[]; total: number }

const FORM_ID = 'tag-drawer-form'

/**
 * The tag drawer (`20-feature-ideas-and-engagement.md` rule 12): the tag's facts and where it is
 * used in view mode; name, colour and a live preview for create and edit. Edit and Delete appear
 * only for a role that may manage tags.
 */
export function TagDrawer({
  open,
  usage,
  newColor,
  canManage,
  returnFocusTo,
  onClose,
  onView,
  onEdit,
  onDelete,
}: {
  open: { mode: TagDrawerMode; tag: TagOverview | null } | null
  usage: TagUsage | null
  /** The swatch a new tag starts on, picked at random by the page. */
  newColor: string
  canManage: boolean
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onView: (tagId: string) => void
  onEdit: (tagId: string) => void
  onDelete: (tag: TagOverview) => void
}) {
  const tag = open?.tag ?? null
  const mode = open?.mode ?? 'view'
  const formKey = mode === 'view' ? null : (tag?.id ?? 'new')

  const [outcome, submit, saving] = useActionState(
    async (_previous: Outcome, data: FormData): Promise<Outcome> => {
      const result = await saveTag(tag?.id ?? null, data)
      if (result.savedId) onView(result.savedId)
      return { ...result, formKey }
    },
    { ...IDLE, formKey: null },
  )

  let body: ReactNode = null
  let footer: ReactNode = null
  if (open !== null && mode === 'view' && tag) {
    body = <TagFacts tag={tag} usage={usage} />
    footer = canManage ? (
      <>
        <Button onClick={() => onEdit(tag.id)}>
          <Icon name="edit" />
          Edit
        </Button>
        <span className="flex-1" />
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(tag)}
        >
          <Icon name="trash" />
          Delete
        </Button>
      </>
    ) : null
  } else if (open !== null && mode !== 'view') {
    body = (
      <TagForm
        // A fresh form per tag, so one tag's typing never seeds another's.
        key={formKey}
        tag={tag}
        initialColor={tag?.color ?? newColor}
        action={submit}
        outcome={outcome.formKey === formKey ? outcome : IDLE}
      />
    )
    footer = (
      <>
        <Button
          variant="outline"
          onClick={() => (mode === 'edit' && tag ? onView(tag.id) : onClose())}
        >
          Cancel
        </Button>
        <span className="flex-1" />
        <Button type="submit" form={FORM_ID} disabled={saving}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create tag' : 'Save changes'}
        </Button>
      </>
    )
  }

  return (
    <Drawer
      open={open !== null}
      onClose={onClose}
      eyebrow={mode === 'create' ? 'New tag' : mode === 'edit' ? 'Edit tag' : 'Tag'}
      title={mode === 'create' ? 'Add New Tag' : (tag?.name ?? '')}
      footer={footer}
      returnFocusTo={returnFocusTo}
      focusKey={mode}
    >
      {body}
    </Drawer>
  )
}

const IDLE: TagFormState = { error: null, errors: {}, savedId: null }

/** The last save's answer, and which form it belongs to, so it never shows on another tag's. */
type Outcome = TagFormState & { formKey: string | null }

/** Name and colour are held here, for the live preview; the save is the drawer's. */
function TagForm({
  tag,
  initialColor,
  action,
  outcome,
}: {
  tag: TagOverview | null
  initialColor: string
  action: (data: FormData) => void
  outcome: TagFormState
}) {
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(initialColor)

  return (
    <form id={FORM_ID} action={action}>
      {outcome.error ? (
        <Alert variant="destructive" className="mb-4">
          <span>{outcome.error}</span>
        </Alert>
      ) : null}
      <Field
        htmlFor="tag-name"
        label="Tag"
        required
        hint="Up to 100 characters. Tags are matched without regard to case."
        error={outcome.errors.name}
      >
        <Input
          id="tag-name"
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          invalid={outcome.errors.name !== undefined}
        />
      </Field>
      <ColorPicker id="tag-color" name="color" value={color} onChange={setColor} />
      {outcome.errors.color ? (
        <span className="mt-1 block text-xs font-semibold text-destructive">
          {outcome.errors.color}
        </span>
      ) : null}
      <div className="mt-4">
        <Label htmlFor="tag-preview">Preview</Label>
        <output id="tag-preview" htmlFor="tag-name tag-color-custom" className="block">
          <TagChip color={color}>{name.trim() || 'new-tag'}</TagChip>
        </output>
      </div>
    </form>
  )
}

function TagFacts({ tag, usage }: { tag: TagOverview; usage: TagUsage | null }) {
  const boardName = (boardId: string) => tag.boards.find((board) => board.id === boardId)?.name
  const facts: [string, ReactNode][] = [
    ['Ideas', tag.ideaCount],
    [
      'Colour',
      <span key="c" className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block size-3.5 rounded-full border border-input"
          style={{ background: tag.color }}
        />
        <Meta>{tag.color}</Meta>
      </span>,
    ],
    ['Created', tag.createdOn],
    ['By', tag.createdBy ?? '—'],
    ...(tag.organization ? [['Organization', tag.organization.name] as [string, ReactNode]] : []),
  ]

  return (
    <>
      <div>
        <TagChip color={tag.color} size="lg">
          {tag.name}
        </TagChip>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="m-0 mt-0.5 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Used on</h3>
        {tag.ideaCount === 0 || !usage || usage.ideas.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            Not used yet. It will be offered when anyone tags an idea.
          </p>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {usage.ideas.map((idea) => (
                <li key={idea.id}>
                  <Link href={`/ideas?idea=${encodeURIComponent(idea.id)}`} className="font-medium">
                    {idea.title}
                  </Link>
                  {boardName(idea.boardId) ? (
                    <span className="text-muted-foreground"> · {boardName(idea.boardId)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {usage.total > usage.ideas.length ? (
              <p className="m-0 text-xs text-muted-foreground">
                And {usage.total - usage.ideas.length} more.{' '}
                <Link href={`/ideas?tag=${encodeURIComponent(tag.name)}`}>
                  See them all in Ideas
                </Link>
              </p>
            ) : null}
          </>
        )}
      </section>
    </>
  )
}
