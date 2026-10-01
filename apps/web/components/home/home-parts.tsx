import { Card, CardContent, cn, Meta } from '@collega/design-system'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PriorityMarker, StatusMarker } from '@/components/ideas/idea-chips'
import { Icon } from '@/components/list/icons'
import { compactAge } from '@/lib/display'
import type { HomeIdea, HomeKpi } from '@/lib/types'

/** Home's pieces (comp R `comp-r-home-dashboard.html`): tiles, panels and the idea rows. */

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

export const ideaHref = (id: string) => `/ideas?idea=${encodeURIComponent(id)}`

function Tile({ children, untracked = false }: { children: ReactNode; untracked?: boolean }) {
  return (
    <li>
      <Card className={cn('h-full', untracked && 'border-dashed bg-transparent shadow-none')}>
        <CardContent className="flex h-full flex-col gap-0.5">{children}</CardContent>
      </Card>
    </li>
  )
}

/** Every tile says what it counts, and its number opens that query where a screen can show it. */
export function KpiRow({
  label,
  kpis,
  children,
}: {
  label: string
  kpis: HomeKpi[]
  children?: ReactNode
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[380px]:grid-cols-2 min-[1100px]:grid-cols-4"
    >
      {kpis.map((kpi) => (
        <Tile key={kpi.label}>
          <Meta caps>{kpi.label}</Meta>
          <span className="self-start font-heading text-[26px] leading-tight font-semibold tabular-nums sm:text-3xl">
            {kpi.href ? (
              <Link href={kpi.href} className="text-foreground no-underline hover:underline">
                {kpi.value}
              </Link>
            ) : (
              kpi.value
            )}
          </span>
          <span
            className={cn(
              'text-sm',
              kpi.detailAlert ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            {kpi.detail}
          </span>
          <p className="m-0 mt-1.5 text-xs text-muted-foreground">{kpi.definition}</p>
        </Tile>
      ))}
      {children}
    </ul>
  )
}

/** The figures the API has no source for yet, kept in view with a dash rather than a guess. */
export function UntrackedTile({ figures }: { figures: string[] }) {
  return (
    <Tile untracked>
      <Meta caps>Not tracked yet</Meta>
      <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-sm">
        {figures.map((figure) => (
          <li key={figure} className="flex justify-between gap-2">
            <span>{figure}</span>
            <span className="text-muted-foreground">
              <span aria-hidden="true">&mdash;</span>
              <span className="sr-only">not tracked yet</span>
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

export function Panel({
  id,
  heading,
  standfirst,
  action,
  className,
  children,
}: {
  id: string
  heading: ReactNode
  standfirst?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <h2
            id={id}
            className="m-0 flex items-center gap-2 text-[17px] leading-snug font-semibold"
          >
            {heading}
          </h2>
          {standfirst ? (
            <p className="m-0 mt-0.5 max-w-prose text-sm text-muted-foreground">{standfirst}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A bordered list whose rows wrap rather than scroll, so it reads at phone width. */
export function Rows({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="m-0 list-none p-0">{children}</ul>
      {footer ? <div className="border-t bg-muted/40 px-4 py-2 text-sm">{footer}</div> : null}
    </div>
  )
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t px-3 py-2.5 first:border-t-0 hover:bg-muted/40 sm:px-4',
        className,
      )}
    >
      {children}
    </li>
  )
}

/** The title and the line beneath it, left of a row's markers. */
export function RowTitle({ href, title, sub }: { href: string; title: string; sub: ReactNode }) {
  return (
    <span className="min-w-0 flex-[1_1_240px]">
      <Link href={href} className="font-semibold text-foreground no-underline hover:underline">
        {title}
      </Link>
      {sub ? <span className="block text-xs text-muted-foreground">{sub}</span> : null}
    </span>
  )
}

/**
 * An idea row in one of Home's lists. `detail` picks what sits right of the status: the age and
 * priority (the attention queue), the priority (Assigned to me), or the upvotes (Most upvoted).
 */
export function IdeaRow({
  idea,
  detail,
  now,
}: {
  idea: HomeIdea
  detail: 'age' | 'priority' | 'votes'
  now: Date
}) {
  const sub = [idea.boardName, detail === 'age' ? idea.ideaType : null].filter(Boolean).join(' · ')
  return (
    <Row>
      <RowTitle href={ideaHref(idea.id)} title={idea.title} sub={sub} />
      <span className="flex flex-wrap items-center gap-3">
        <StatusMarker name={idea.status.name} color={idea.status.color} />
        {detail === 'votes' ? (
          <span
            className={cn(
              'inline-flex min-w-[42px] items-center gap-0.5 rounded-full py-0 pr-2 pl-1 text-xs font-semibold',
              idea.hasUpvoted ? 'bg-primary/15 text-foreground' : 'bg-muted text-foreground',
            )}
            title={idea.hasUpvoted ? 'You upvoted this' : 'Upvotes'}
          >
            <Icon name="asc" />
            {idea.upvotes}
            <span className="sr-only">
              {idea.upvotes === 1 ? ' upvote' : ' upvotes'}
              {idea.hasUpvoted ? ', including yours' : ''}
            </span>
          </span>
        ) : (
          <PriorityMarker priority={idea.priority} />
        )}
        {detail === 'age' ? (
          <span
            className="min-w-[34px] text-right font-mono text-xs text-muted-foreground"
            title={`Created ${idea.createdAtUtc.slice(0, 10)}`}
          >
            {compactAge(idea.createdAtUtc, now)}
          </span>
        ) : null}
      </span>
    </Row>
  )
}

/** A panel's body when the panel has nothing to list. */
export function EmptyNote({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-4 py-3.5 text-sm text-muted-foreground">
      {heading ? <b className="mb-0.5 block text-base text-foreground">{heading}</b> : null}
      {children}
    </div>
  )
}

/** A panel the API cannot fill yet: it keeps its place and says so. */
export function NotAvailable({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-lg border border-dashed px-4 py-3.5 text-sm text-muted-foreground">
      Not available yet. {children}
    </p>
  )
}
