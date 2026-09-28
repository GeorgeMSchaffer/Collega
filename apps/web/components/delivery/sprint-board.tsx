'use client'

import {
  Alert,
  Button,
  buttonVariants,
  cn,
  EffortBar,
  EmptyState,
  Meta,
} from '@collega/design-system'
import Link from 'next/link'
import {
  type DragEvent,
  type ReactNode,
  useEffect,
  useId,
  useOptimistic,
  useState,
  useTransition,
} from 'react'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { People, TagList } from '@/components/ideas/idea-chips'
import { useDrawerUrl } from '@/components/ideas/use-drawer-url'
import { ConfirmDialog, Drawer } from '@/components/list'
import { DELIVERY_STATUSES } from '@/lib/display'
import { mayWorkOnIssue } from '@/lib/roles'
import { completeSprint, setDeliveryStatus, startSprint } from '@/lib/server/delivery-actions'
import { useCurrentUser } from '@/lib/session-client'
import type { Issue, MemberOption, Sprint } from '@/lib/types'
import { IssueDrawer } from './issue-drawer'
import type { IssueDrawerData } from './load-issue-drawer'
import { SprintForm } from './sprint-form'
import { useToast } from './toast'

const COMPLETE = 'Complete'
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * *{N} DAYS PAST END*, counted in the reader's own calendar days — so it is worked out in the
 * browser, after hydration, rather than on the server in the server's timezone.
 */
function DaysPastEnd({ endDate }: { endDate: string }) {
  const [days, setDays] = useState(0)
  useEffect(() => {
    const [y = 0, m = 1, d = 1] = endDate.split('-').map(Number)
    const now = new Date()
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    setDays(Math.round((today - Date.UTC(y, m - 1, d)) / 86_400_000))
  }, [endDate])
  if (days <= 0) return null
  return <Badge tone="warning">{`${plural(days, 'DAY')} PAST END`}</Badge>
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'muted'; children: string }) {
  return (
    <span
      className={cn(
        'rounded-[4px] border border-current px-1.5 font-mono text-[10.5px] font-medium leading-[18px] tracking-[0.04em]',
        tone === 'success' && 'text-success',
        tone === 'warning' && 'text-warning',
        tone === 'muted' && 'text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

function StripCell({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-[18px] py-3.5">
      <dt>
        <Meta caps>{term}</Meta>
      </dt>
      <dd className="m-0 flex flex-wrap items-center gap-2 font-mono text-[13px] font-medium">
        {children}
      </dd>
    </div>
  )
}

/**
 * The Sprint board (comp R, `20-feature-issues-and-delivery.md` "Sprint board (comp R)"): the
 * sprint's header and actions, the STATE / WINDOW / ISSUES / PROGRESS strip, five lanes of Issue
 * cards that move by drag, and the Issue drawer over them. With no sprint running it shows the
 * next planned one with *Start sprint*; with neither, the empty state.
 *
 * Who may move a card is the author, an assignee or an Org Admin; the sprint actions are an Org
 * Admin's and shown disabled with `adminDenial` to everyone else. The API decides both again.
 */
export function SprintBoard({
  sprint,
  issues,
  backlogCount,
  organizationId,
  organizationName,
  adminDenial,
  members,
  drawer,
  editing,
  missing,
}: {
  sprint: Sprint | null
  issues: Issue[]
  backlogCount: number
  organizationId: string | null
  organizationName: string | null
  adminDenial: string | null
  members: MemberOption[]
  drawer: IssueDrawerData | null
  editing: boolean
  missing: boolean
}) {
  const user = useCurrentUser()
  const openDrawer = useDrawerUrl()
  const planFormId = useId()
  const [toast, showToast] = useToast()
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [planning, setPlanning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirming, setConfirming] = useState<'start' | 'complete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  // A drop moves the card at once; the page re-reads on success, and a refusal puts it back.
  const [shown, moveCard] = useOptimistic(
    issues,
    (list: Issue[], move: { id: string; to: string }) =>
      list.map((issue) => (issue.id === move.id ? { ...issue, deliveryStatusId: move.to } : issue)),
  )

  const done = shown.filter((issue) => issue.deliveryStatusId === COMPLETE).length
  const unfinished = shown.length - done
  const selectedId = drawer?.issue.id ?? null

  // A card that changed lane was re-rendered, so its old button is gone: return to the new one.
  const returnFocusTo = trigger?.isConnected
    ? trigger
    : openedId
      ? document.querySelector<HTMLElement>(`[data-issue="${CSS.escape(openedId)}"]`)
      : null

  const open = (ideaId: string, from: HTMLElement) => {
    if (!drawer) setTrigger(from)
    setOpenedId(ideaId)
    setPlanning(false)
    openDrawer({ view: ideaId })
  }

  const plan = (from: HTMLElement) => {
    setTrigger(from)
    if (drawer) openDrawer(null)
    setPlanning(true)
  }

  const drop = (to: string) => {
    const id = dragging
    setDragging(null)
    setOver(null)
    const issue = shown.find((candidate) => candidate.id === id)
    if (!issue || issue.deliveryStatusId === to) return
    setError(null)
    startTransition(async () => {
      moveCard({ id: issue.id, to })
      const result = await setDeliveryStatus(issue.id, to)
      if (result.error) setError(`“${issue.title}” was not moved: ${result.error}`)
    })
  }

  const confirm = () => {
    if (!sprint || !organizationId || !confirming) return
    const action = confirming
    startTransition(async () => {
      const result =
        action === 'start'
          ? await startSprint(organizationId, sprint.id)
          : await completeSprint(organizationId, sprint.id)
      setConfirming(null)
      setError(result.error)
      if (!result.error) {
        showToast(
          action === 'start'
            ? 'Sprint started'
            : `Sprint completed · ${plural(unfinished, 'issue')} back in the backlog`,
        )
      }
    })
  }

  const adminButton = (
    id: string,
    label: string,
    onClick: (from: HTMLElement) => void,
    variant: 'default' | 'outline',
  ) => (
    <GatedAction id={id} label={label} denial={adminDenial} variant={variant}>
      <Button variant={variant} onClick={(event) => onClick(event.currentTarget)}>
        {label}
      </Button>
    </GatedAction>
  )

  const planButton = (id: string) => adminButton(id, 'Plan next sprint', plan, 'outline')

  return (
    <>
      <PageHeader
        title={sprint ? sprint.name : 'Sprint board'}
        description={
          sprint
            ? sprint.goal
              ? `Goal: ${sprint.goal}`
              : null
            : 'Issues committed to the running sprint, in five fixed delivery statuses.'
        }
        action={
          <>
            {planButton('why-plan')}
            {sprint?.state === 'Active'
              ? adminButton(
                  'why-complete',
                  'Complete sprint',
                  () => setConfirming('complete'),
                  'default',
                )
              : sprint?.state === 'Planned'
                ? adminButton('why-start', 'Start sprint', () => setConfirming('start'), 'default')
                : null}
          </>
        }
      />

      {error ? (
        <Alert variant="destructive" role="alert">
          <span>{error}</span>
        </Alert>
      ) : null}
      {missing ? (
        <Alert variant="note" role="status">
          <span>
            That issue could not be opened. It may have been returned to discovery or deleted.
          </span>
        </Alert>
      ) : null}

      {sprint ? (
        <>
          <dl className="m-0 grid grid-cols-1 rounded-lg border bg-card min-[900px]:grid-cols-[minmax(0,1fr)_repeat(3,minmax(120px,160px))] [&>div+div]:border-t min-[900px]:[&>div+div]:border-t-0 min-[900px]:[&>div+div]:border-l">
            <StripCell term="STATE">
              {sprint.state === 'Active' ? (
                <>
                  <Badge tone="success">● ACTIVE</Badge>
                  <DaysPastEnd endDate={sprint.endDate} />
                </>
              ) : (
                <Badge tone="muted">PLANNED</Badge>
              )}
            </StripCell>
            <StripCell term="WINDOW">{sprint.window}</StripCell>
            <StripCell term="ISSUES">
              {shown.length} · {done} DONE
            </StripCell>
            <StripCell term="PROGRESS">
              <span
                role="img"
                aria-label={`${done} of ${shown.length} done`}
                className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-[3px] bg-muted"
              >
                {shown.map((issue) => (
                  <span
                    key={issue.id}
                    className={cn(
                      'flex-1',
                      issue.deliveryStatusId === COMPLETE ? 'bg-success' : 'bg-input',
                    )}
                  />
                ))}
              </span>
            </StripCell>
          </dl>

          <div className="grid grid-cols-[repeat(5,minmax(200px,1fr))] gap-2.5 overflow-x-auto pb-3 min-[900px]:grid-cols-5 min-[900px]:overflow-visible">
            {DELIVERY_STATUSES.map((status) => {
              const inLane = shown.filter((issue) => issue.deliveryStatusId === status.id)
              return (
                <section
                  key={status.id}
                  aria-label={status.name}
                  onDragOver={(event: DragEvent) => {
                    if (!dragging) return
                    event.preventDefault()
                    setOver(status.id)
                  }}
                  onDragLeave={() => setOver((current) => (current === status.id ? null : current))}
                  onDrop={(event: DragEvent) => {
                    event.preventDefault()
                    drop(status.id)
                  }}
                  className={cn(
                    'flex min-h-[min(56vh,520px)] min-w-0 flex-col gap-2 rounded-[14px] border border-border/70 bg-muted/55 px-1.5 pt-1.5 pb-3',
                    over === status.id && 'border-primary',
                  )}
                >
                  {/* The status colour is data, so it tints the header against the theme's card
                      and ink rather than standing alone as a raw fill. */}
                  <div
                    className="flex items-center gap-2 rounded-t-xl rounded-b-sm px-3 py-1.5 text-[13px] font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${status.color} 14%, var(--card))`,
                      color: `color-mix(in srgb, ${status.color} 55%, var(--foreground))`,
                    }}
                  >
                    <h2 className="m-0 flex-1 text-[13px] font-semibold">{status.name}</h2>
                    <span className="font-mono text-xs font-medium opacity-80">
                      {inLane.length}
                      <span className="sr-only"> issues</span>
                    </span>
                  </div>
                  {inLane.length === 0 ? (
                    <div className="rounded-[10px] border border-dashed border-input p-3.5 text-center text-xs text-muted-foreground">
                      No issues
                    </div>
                  ) : (
                    inLane.map((issue) => {
                      const movable = mayWorkOnIssue(user.role, user.userId, issue)
                      return (
                        <article
                          key={issue.id}
                          draggable={movable}
                          onDragStart={(event: DragEvent) => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', issue.id)
                            setDragging(issue.id)
                          }}
                          onDragEnd={() => {
                            setDragging(null)
                            setOver(null)
                          }}
                          aria-current={selectedId === issue.id ? 'true' : undefined}
                          className={cn(
                            'flex flex-col gap-2 rounded-[10px] border bg-card p-2.5 text-foreground hover:border-primary',
                            movable && 'cursor-grab active:cursor-grabbing',
                            issue.deliveryStatusId === COMPLETE && 'bg-muted/60',
                            selectedId === issue.id &&
                              'outline-2 -outline-offset-1 outline-primary',
                            dragging === issue.id && 'opacity-60',
                          )}
                        >
                          <div className="flex min-h-6 items-center justify-end">
                            {issue.assignees.length > 0 ? (
                              <People people={issue.assignees} quiet />
                            ) : (
                              <span
                                role="img"
                                aria-label="Unassigned"
                                title="Unassigned"
                                className="inline-grid size-6 place-items-center rounded-full border border-dashed border-input text-[10px] text-muted-foreground"
                              >
                                —
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            data-issue={issue.id}
                            onClick={(event) => open(issue.id, event.currentTarget)}
                            className="text-left text-[13px] leading-snug font-semibold hover:text-accent-foreground hover:underline"
                          >
                            {issue.title}
                          </button>
                          <TagList tags={issue.tags} max={2} />
                          <EffortBar effort={issue.effort} />
                        </article>
                      )
                    })
                  )}
                </section>
              )
            })}
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            Only the person who raised an issue, an assignee or an admin can move it: drag its card
            to another lane, or change its status in the issue&rsquo;s detail.
          </p>
        </>
      ) : (
        <EmptyState
          heading="No sprint is running"
          action={
            <div className="flex flex-col items-start gap-2">
              {planButton('why-plan-empty')}
              <Link href="/delivery/backlog" className={buttonVariants({ variant: 'outline' })}>
                See the backlog
              </Link>
            </div>
          }
        >
          {organizationName ?? 'This deployment'} has {plural(backlogCount, 'issue')} in the
          delivery backlog and no sprint running or planned. An administrator plans a sprint, then
          starts it here.
        </EmptyState>
      )}

      <IssueDrawer
        data={drawer}
        editing={editing}
        returnFocusTo={returnFocusTo}
        onClosed={() => setTrigger(null)}
      />

      {organizationId ? (
        <Drawer
          open={planning}
          onClose={() => setPlanning(false)}
          eyebrow="Sprints · New"
          title="Add New Sprint"
          returnFocusTo={trigger}
          footer={
            <>
              <Button type="submit" form={planFormId} disabled={creating}>
                {creating ? 'Creating…' : 'Create sprint'}
              </Button>
              <Button variant="outline" onClick={() => setPlanning(false)}>
                Cancel
              </Button>
            </>
          }
        >
          {planning ? (
            <SprintForm
              formId={planFormId}
              organizationId={organizationId}
              members={members}
              onPendingChange={setCreating}
              onCreated={() => {
                setPlanning(false)
                showToast('Sprint created')
              }}
            />
          ) : null}
        </Drawer>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === 'start' ? 'Start this sprint?' : 'Complete this sprint?'}
        description={
          confirming === 'start'
            ? `“${sprint?.name ?? ''}” becomes the running sprint, ${plural(shown.length, 'issue')}.`
            : `${plural(unfinished, 'unfinished issue')} ${unfinished === 1 ? 'returns' : 'return'} to the backlog. Completed issues stay with the sprint.`
        }
        confirmLabel={confirming === 'start' ? 'Start sprint' : 'Complete sprint'}
        destructive={false}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
      />

      {toast}
    </>
  )
}
