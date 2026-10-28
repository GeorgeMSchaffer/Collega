'use client'

import { Alert, Button, Field, Input, Textarea } from '@collega/design-system'
import { type ReactNode, useActionState, useState } from 'react'
import { LockMark } from '@/components/access/lock-mark'
import { PeoplePicker } from '@/components/access/people-picker'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { type GroupFormState, saveGroup } from '@/lib/server/group-actions'
import type { GroupDetail } from '@/lib/types'

/** Someone the member picker offers: any user of the organization, any role, any status. */
export type GroupPerson = { id: string; name: string; roleLabel: string; active: boolean }

const FORM_ID = 'group-drawer-form'
const IDLE: GroupFormState = { error: null, errors: {}, savedId: null }

/** The last save's answer, and which form it belongs to, so it never shows on another group's. */
type Outcome = GroupFormState & { formKey: string | null }

/**
 * The group drawer (BAG-6a; comp R board access): name, description and members, and the
 * Restricted boards the group is on. An Org Admin edits in place; anyone else reads.
 */
export function GroupDrawer({
  open,
  canManage,
  people,
  returnFocusTo,
  onClose,
  onSaved,
  onDelete,
}: {
  open: { isNew: boolean; group: GroupDetail | null } | null
  canManage: boolean
  people: GroupPerson[]
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onSaved: (groupId: string) => void
  onDelete: (group: GroupDetail) => void
}) {
  const group = open?.group ?? null
  const isNew = open?.isNew ?? false
  const formKey = open === null ? null : (group?.id ?? 'new')

  const [outcome, submit, saving] = useActionState(
    async (_previous: Outcome, data: FormData): Promise<Outcome> => {
      const result = await saveGroup(group?.id ?? null, data)
      if (result.savedId) onSaved(result.savedId)
      return { ...result, formKey }
    },
    { ...IDLE, formKey: null },
  )

  let footer: ReactNode = null
  if (open !== null && canManage) {
    footer = (
      <>
        <Button type="submit" form={FORM_ID} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Create group' : 'Save'}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <span className="flex-1" />
        {group ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(group)}
          >
            <Icon name="trash" />
            Delete
          </Button>
        ) : null}
      </>
    )
  } else if (open !== null) {
    footer = (
      <>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon name="lock" className="size-3.5" />
          Only Org Admins can change groups.
        </span>
        <span className="flex-1" />
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </>
    )
  }

  return (
    <Drawer
      open={open !== null}
      onClose={onClose}
      eyebrow={isNew ? 'New group' : 'Group'}
      title={isNew ? 'New group' : (group?.name ?? '')}
      footer={footer}
      returnFocusTo={returnFocusTo}
      focusKey={formKey ?? 'closed'}
    >
      {open === null ? null : (
        <GroupForm
          // A fresh form per group, so one group's typing never seeds another's.
          key={formKey}
          group={group}
          canManage={canManage}
          people={people}
          action={submit}
          outcome={outcome.formKey === formKey ? outcome : IDLE}
        />
      )}
    </Drawer>
  )
}

function GroupForm({
  group,
  canManage,
  people,
  action,
  outcome,
}: {
  group: GroupDetail | null
  canManage: boolean
  people: GroupPerson[]
  action: (data: FormData) => void
  outcome: GroupFormState
}) {
  // The group's own member rows carry role and status, so they name someone the picker list lacks.
  const known = new Map<string, GroupPerson>(people.map((person) => [person.id, person]))
  for (const member of group?.members ?? []) {
    if (!known.has(member.id)) {
      known.set(member.id, {
        id: member.id,
        name: member.name,
        roleLabel: member.roleLabel,
        active: member.active,
      })
    }
  }
  const [memberIds, setMemberIds] = useState(group?.members.map((member) => member.id) ?? [])
  const [announcement, setAnnouncement] = useState('')

  const members = memberIds
    .flatMap((id) => known.get(id) ?? [])
    .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)))
  const offered = people
    .filter((person) => !memberIds.includes(person.id))
    .map((person) => ({
      kind: 'person' as const,
      id: person.id,
      name: person.name,
      detail: person.active ? person.roleLabel : `${person.roleLabel} · inactive`,
    }))

  return (
    <form id={FORM_ID} action={action} className="flex flex-col gap-4">
      {outcome.error ? (
        <Alert variant="destructive">
          <span>{outcome.error}</span>
        </Alert>
      ) : null}
      {memberIds.map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}

      <Field htmlFor="group-name" label="Name" required error={outcome.errors.name}>
        <Input
          id="group-name"
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={group?.name ?? ''}
          readOnly={!canManage}
          invalid={outcome.errors.name !== undefined}
        />
      </Field>
      <Field
        htmlFor="group-description"
        label="Description (optional)"
        error={outcome.errors.description}
      >
        <Textarea
          id="group-description"
          name="description"
          maxLength={500}
          rows={2}
          defaultValue={group?.description ?? ''}
          readOnly={!canManage}
        />
      </Field>

      <section className="flex flex-col gap-2" aria-labelledby="group-members-label">
        <h3 id="group-members-label" className="m-0 text-sm font-semibold">
          Members · {members.length}
        </h3>
        {canManage ? (
          <PeoplePicker
            id="group-member-picker"
            labelledBy="group-members-label"
            placeholder="Add people"
            options={offered}
            onPick={(option) => {
              setMemberIds((current) => [...current, option.id])
              setAnnouncement(`${option.name} added`)
            }}
          />
        ) : null}
        {outcome.errors.userIds ? (
          <p role="alert" className="m-0 text-xs font-semibold text-destructive">
            {outcome.errors.userIds}
          </p>
        ) : null}
        {members.length > 0 ? (
          <ul className="m-0 list-none rounded-md border p-0">
            {members.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-2.5 border-t px-2.5 py-1.5 first:border-t-0"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-semibold">{person.name}</b>
                  <span className="block text-xs text-muted-foreground">{person.roleLabel}</span>
                </span>
                {person.active ? null : (
                  <span className="rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">
                    Inactive
                  </span>
                )}
                {canManage ? (
                  <button
                    type="button"
                    aria-label={`Remove ${person.name}`}
                    className="inline-grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setMemberIds((current) => current.filter((id) => id !== person.id))
                      setAnnouncement(`${person.name} removed`)
                    }}
                  >
                    <Icon name="x" className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">No members yet.</p>
        )}
        <p className="m-0 text-xs text-muted-foreground">
          Anyone in the organization, any role. An inactive member keeps their place and regains
          access if reactivated.
        </p>
        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </section>

      {group ? (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">On boards</h3>
          {group.boards.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {group.boards.map((board) => (
                <li
                  key={board.id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm"
                >
                  <LockMark />
                  {board.name}
                  {board.isArchived ? (
                    <span className="text-xs text-muted-foreground">archived</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              Not on any Restricted board you can see.
            </p>
          )}
        </section>
      ) : null}
    </form>
  )
}

/** Members sort by last name, as the API lists them. */
function lastName(name: string): string {
  const parts = name.split(' ')
  return `${parts.slice(1).join(' ')} ${parts[0] ?? ''}`
}
