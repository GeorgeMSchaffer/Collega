'use client'

import { Alert } from '@collega/design-system'
import { useState } from 'react'
import { Icon } from '@/components/list/icons'
import type { AccessSetup } from '@/lib/types'
import { PeoplePicker } from './people-picker'

/**
 * The board form's Access section (BAG-6b; comp R board access): *Everyone in the organization* or
 * *Only people and groups I choose*, the combined picker, and how many people that lets in. Shown
 * only to a caller with `canManageAccess`; the API decides the rest.
 *
 * Switching back to everyone keeps the list (BAG-2e), so it stays posted and is shown dimmed.
 */
export function AccessSection({
  setup,
  sectionHeading: SectionHeading = 'h2',
}: {
  setup: AccessSetup
  sectionHeading?: 'h2' | 'h3'
}) {
  const [restricted, setRestricted] = useState(setup.restricted)
  const [userIds, setUserIds] = useState(setup.userIds)
  const [groupIds, setGroupIds] = useState(setup.groupIds)
  const [showWho, setShowWho] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const person = (id: string) => setup.people.find((candidate) => candidate.id === id)
  const group = (id: string) => setup.groups.find((candidate) => candidate.id === id)
  const creatorId = setup.creator?.id ?? null
  const creatorName = creatorId === setup.readerId ? 'you' : (setup.creator?.name ?? 'its creator')
  const rolesKnown = setup.people.every((candidate) => candidate.role !== null)

  const active = setup.people.filter((candidate) => candidate.active)
  const why = (id: string, role: string | null): string | null => {
    if (role === 'OrgAdmin') return 'Org Admin'
    if (id === creatorId) return 'Created the board'
    const via = groupIds.flatMap((gid) => {
      const chosen = group(gid)
      return chosen?.memberIds.includes(id) ? [chosen.name] : []
    })
    const parts = [
      ...(userIds.includes(id) ? ['Chosen directly'] : []),
      ...(via.length > 0 ? [`Through ${via.join(', ')}`] : []),
    ]
    return parts.length > 0 ? parts.join(' · ') : null
  }
  const seers = active.flatMap((candidate) => {
    const reason = why(candidate.id, candidate.role)
    return reason ? [{ ...candidate, reason }] : []
  })

  // Org Admins and the creator always see the board, so they are not offered (when roles are known).
  const offered = [
    ...setup.groups
      .filter((candidate) => !groupIds.includes(candidate.id))
      .map((candidate) => ({
        kind: 'group' as const,
        id: candidate.id,
        name: candidate.name,
        detail: `${candidate.memberIds.length} people`,
      })),
    ...setup.people
      .filter(
        (candidate) =>
          !userIds.includes(candidate.id) &&
          candidate.role !== 'OrgAdmin' &&
          candidate.id !== creatorId,
      )
      .map((candidate) => ({
        kind: 'person' as const,
        id: candidate.id,
        name: candidate.name,
        detail: candidate.active ? '' : 'inactive',
      })),
  ]

  const listed = userIds.length > 0 || groupIds.length > 0
  const empty = restricted && !listed

  return (
    <fieldset className="mb-4 flex min-w-0 flex-col gap-3 border-0 p-0">
      <input type="hidden" name="accessShown" value="1" />
      <input type="hidden" name="visibility" value={restricted ? 'Restricted' : 'Organization'} />
      {userIds.map((id) => (
        <input key={`u-${id}`} type="hidden" name="accessUserIds" value={id} />
      ))}
      {groupIds.map((id) => (
        <input key={`g-${id}`} type="hidden" name="accessGroupIds" value={id} />
      ))}

      <legend className="p-0">
        <SectionHeading className="m-0 text-sm font-semibold">Access</SectionHeading>
      </legend>
      <div role="radiogroup" aria-label="Who can see this board" className="grid gap-2">
        <Choice
          checked={!restricted}
          onSelect={() => setRestricted(false)}
          title={`Everyone in ${setup.organizationName}`}
          detail="Every member sees the board. Roles still decide what they can change."
        />
        <Choice
          checked={restricted}
          onSelect={() => setRestricted(true)}
          title="Only people and groups I choose"
          detail="Nobody else sees it, or anything on it, anywhere in Collega."
        />
      </div>

      {restricted || listed ? (
        <div className={`flex flex-col gap-2 ${restricted ? '' : 'opacity-55'}`}>
          <span id="access-picker-label" className="text-sm font-medium text-secondary-foreground">
            People and groups
          </span>
          <PeoplePicker
            id="access-picker"
            labelledBy="access-picker-label"
            placeholder="Add people or groups"
            disabled={!restricted}
            options={offered}
            onPick={(option) => {
              if (option.kind === 'group') setGroupIds((current) => [...current, option.id])
              else setUserIds((current) => [...current, option.id])
              setAnnouncement(`${option.name} added`)
            }}
          />
          {listed ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {groupIds.map((id) => (
                <Chip
                  key={`g-${id}`}
                  label={group(id)?.name ?? 'A deleted group'}
                  detail={String(group(id)?.memberIds.length ?? 0)}
                  isGroup
                  removable={restricted}
                  onRemove={(name) => {
                    setGroupIds((current) => current.filter((gid) => gid !== id))
                    setAnnouncement(`${name} removed`)
                  }}
                />
              ))}
              {userIds.map((id) => {
                const chosen = person(id)
                return (
                  <Chip
                    key={`u-${id}`}
                    label={chosen?.name ?? 'Someone no longer listed'}
                    detail={chosen && !chosen.active ? '· inactive' : ''}
                    removable={restricted}
                    onRemove={(name) => {
                      setUserIds((current) => current.filter((uid) => uid !== id))
                      setAnnouncement(`${name} removed`)
                    }}
                  />
                )
              })}
            </ul>
          ) : null}
          <p className="m-0 text-xs text-muted-foreground">
            Org Admins and the board&rsquo;s creator ({creatorName}) always see this board, so they
            are not offered here.
          </p>
        </div>
      ) : null}

      {!restricted && listed ? (
        <p className="m-0 text-xs text-muted-foreground">
          Your list is kept and applies again if you choose &ldquo;Only people and groups I
          choose&rdquo;.
        </p>
      ) : null}

      {empty ? (
        <Alert variant="note" role="note">
          <span>
            No one is chosen yet, so only Org Admins and {creatorName} can see this board.
          </span>
        </Alert>
      ) : null}

      {rolesKnown ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
          <Icon name="group" />
          <span>
            <b className="tabular-nums">{restricted ? seers.length : active.length}</b>{' '}
            {restricted
              ? `of ${active.length} people can see this board`
              : 'people can see this board'}
          </span>
          {restricted ? (
            <button
              type="button"
              className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
              aria-expanded={showWho}
              onClick={() => setShowWho((current) => !current)}
            >
              Who?
            </button>
          ) : null}
        </div>
      ) : null}
      {rolesKnown && restricted && showWho ? (
        <ul className="m-0 list-none rounded-md border p-0">
          {seers.map((seer) => (
            <li key={seer.id} className="border-t px-2.5 py-1.5 first:border-t-0">
              <b className="block text-sm font-semibold">{seer.name}</b>
              <span className="block text-xs text-muted-foreground">{seer.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </fieldset>
  )
}

function Choice({
  checked,
  onSelect,
  title,
  detail,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  detail: string
}) {
  return (
    <label
      className={`grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5 rounded-md border bg-card px-3 py-2.5 ${
        checked ? 'border-primary ring-1 ring-primary ring-inset' : ''
      }`}
    >
      <input
        type="radio"
        name="access-choice"
        className="mt-1 accent-primary"
        checked={checked}
        onChange={onSelect}
      />
      <span>
        <b className="block text-sm font-semibold">{title}</b>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  )
}

function Chip({
  label,
  detail,
  isGroup = false,
  removable,
  onRemove,
}: {
  label: string
  detail: string
  isGroup?: boolean
  removable: boolean
  onRemove: (name: string) => void
}) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card py-0.5 pr-1 pl-2 text-sm">
      {isGroup ? <Icon name="group" className="size-3.5 text-primary" /> : null}
      <span className="truncate">{label}</span>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      {removable ? (
        <button
          type="button"
          aria-label={isGroup ? `Remove group ${label}` : `Remove ${label}`}
          className="inline-grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onRemove(label)}
        >
          <Icon name="x" className="size-3" />
        </button>
      ) : null}
    </li>
  )
}
