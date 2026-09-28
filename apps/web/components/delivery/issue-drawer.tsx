'use client'

import { Button, Dot, EffortBar, Marker, Select } from '@collega/design-system'
import { type ReactNode, useId, useOptimistic, useState, useTransition } from 'react'
import { People, TagList } from '@/components/ideas/idea-chips'
import { IdeaForm } from '@/components/ideas/idea-form'
import { IdeaView } from '@/components/ideas/idea-view'
import { useDrawerUrl } from '@/components/ideas/use-drawer-url'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { DELIVERY_STATUSES } from '@/lib/display'
import { engagementDenial, mayEditIdeaContent, mayWorkOnIssue, writeDenial } from '@/lib/roles'
import { setDeliveryStatus } from '@/lib/server/delivery-actions'
import { useCurrentUser } from '@/lib/session-client'
import { IssueTasks } from './issue-tasks'
import type { IssueDrawerData } from './load-issue-drawer'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-0.5 flex flex-wrap items-center gap-1 text-sm font-medium">
        {children}
      </dd>
    </div>
  )
}

/**
 * An Issue in the list and detail drawer (`20-feature-issues-and-delivery.md` "The Issue in the
 * drawer"), over the Sprint board or the Backlog: its delivery facts, provenance and tasks, then the
 * idea's own content and discussion. `&edit=1` swaps in the idea form, as for ideas.
 *
 * The status select is the keyboard and touch path for moving a card, shown to the author, an
 * assignee or an Org Admin; everyone else reads the status.
 */
export function IssueDrawer({
  data,
  editing,
  returnFocusTo,
  onClosed,
}: {
  data: IssueDrawerData | null
  editing: boolean
  returnFocusTo?: HTMLElement | null
  onClosed?: () => void
}) {
  const user = useCurrentUser()
  const openDrawer = useDrawerUrl()
  const formId = useId()
  const statusId = useId()
  const [saving, setSaving] = useState(false)
  // Keyed by the Issue it belongs to, so switching cards with the drawer open drops it.
  const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null)
  const [moving, startMove] = useTransition()

  const issue = data?.issue ?? null
  const idea = data?.idea ?? null
  const canEdit = data !== null && writeDenial(user.role) === null && !data.boardArchived
  const canWork = issue !== null && mayWorkOnIssue(user.role, user.userId, issue)
  const form = editing && canEdit && data?.formOptions != null
  // The select shows the choice while the save is in flight, and falls back on a refusal.
  const [shownStatus, showStatus] = useOptimistic(issue?.deliveryStatusId ?? '')
  const status = DELIVERY_STATUSES.find((s) => s.id === issue?.deliveryStatusId)

  const close = () => {
    setStatusError(null)
    openDrawer(null)
    onClosed?.()
  }

  const changeStatus = (next: string) => {
    if (!issue) return
    startMove(async () => {
      showStatus(next)
      const result = await setDeliveryStatus(issue.id, next)
      setStatusError(result.error ? { id: issue.id, message: result.error } : null)
    })
  }

  const footer = !data ? null : form ? (
    <>
      <Button type="submit" form={formId} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
      <Button variant="outline" onClick={() => openDrawer({ view: data.issue.id })}>
        Cancel
      </Button>
    </>
  ) : canEdit ? (
    <Button onClick={() => openDrawer({ edit: data.issue.id })}>
      <Icon name="edit" />
      Edit
    </Button>
  ) : null

  return (
    <Drawer
      open={data !== null}
      onClose={close}
      eyebrow={
        issue
          ? form
            ? `Edit · Issue`
            : `Issue · ${issue.sprint?.name ?? 'Backlog'} · ${status?.name ?? ''}`
          : null
      }
      title={issue?.title ?? ''}
      footer={footer}
      returnFocusTo={returnFocusTo ?? null}
      focusKey={form ? 'edit' : 'view'}
    >
      {!data || !issue || !idea ? null : form && data.formOptions ? (
        <IdeaForm
          key={`edit-${idea.id}`}
          formId={formId}
          idea={idea}
          options={data.formOptions}
          boards={null}
          boardId={null}
          contentLocked={!mayEditIdeaContent(user.role, user.userId, idea.authorUserId)}
          onSaved={(ideaId) => openDrawer({ view: ideaId })}
          onPendingChange={setSaving}
        />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3">
            <div className="min-w-0">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                {canWork ? (
                  <label
                    htmlFor={statusId}
                    className="m-0 font-mono text-[10.5px] font-medium text-muted-foreground"
                  >
                    Status
                  </label>
                ) : (
                  'Status'
                )}
              </dt>
              <dd className="m-0 mt-0.5 text-sm font-medium">
                {canWork ? (
                  <Select
                    id={statusId}
                    value={shownStatus}
                    aria-busy={moving || undefined}
                    onChange={(event) => changeStatus(event.target.value)}
                  >
                    {DELIVERY_STATUSES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Marker>
                    <Dot color={status?.color} />
                    {status?.name}
                  </Marker>
                )}
                {statusError && statusError.id === issue.id ? (
                  <span role="alert" className="mt-1 block text-xs font-semibold text-destructive">
                    {statusError.message}
                  </span>
                ) : null}
              </dd>
            </div>
            <Fact label="Effort">
              <EffortBar effort={issue.effort} />
            </Fact>
            <Fact label="Sprint">
              {issue.sprint ? (
                <>
                  {issue.sprint.name}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {issue.sprint.window}
                  </span>
                </>
              ) : (
                'Backlog'
              )}
            </Fact>
            <Fact label="Outcome">
              <span className="text-muted-foreground">Not grouped</span>
            </Fact>
            <Fact label="Assignees">
              <People people={issue.assignees} />
              {issue.assignees.length > 0 ? (
                <span aria-hidden="true">{issue.assignees.map((p) => p.name).join(', ')}</span>
              ) : null}
            </Fact>
            <Fact label="Tags">
              {issue.tags.length > 0 ? <TagList tags={issue.tags} max={10} /> : '—'}
            </Fact>
          </dl>

          <section className="rounded-md border px-3 py-2.5 text-sm">
            <h3 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Provenance
            </h3>
            <p className="m-0">
              Raised as an idea{idea.author ? ` by ${idea.author.name}` : ''} on {idea.createdOn} ·{' '}
              <span className="tabular-nums">{issue.upvotesAtPromotion}</span> upvotes at promotion
              (<span className="tabular-nums">{issue.upvotes}</span> now)
              {issue.promotedOn
                ? ` · promoted${issue.promotedBy ? ` by ${issue.promotedBy}` : ''} on ${issue.promotedOn}`
                : null}
            </p>
          </section>

          <IssueTasks
            key={issue.id}
            ideaId={issue.id}
            tasks={data.tasks}
            members={data.members}
            canEdit={canWork}
          />

          <IdeaView
            idea={idea}
            statusColor={undefined}
            engagementDenial={engagementDenial(user.role)}
            facts={false}
          />
        </>
      )}
    </Drawer>
  )
}
