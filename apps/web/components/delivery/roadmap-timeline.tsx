'use client'

import { cn, Meta, Skeleton, SkeletonRegion } from '@collega/design-system'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import {
  DEFAULT_ZOOM,
  dayNumber,
  localToday,
  positionIn,
  type RoadmapWindow,
  readZoom,
  roadmapWindow,
  spanIn,
  ZOOM_LABELS,
  ZOOMS,
  type Zoom,
} from '@/lib/roadmap-window'
import type { Sprint } from '@/lib/types'

const noSubscribe = () => () => {}

/**
 * "Today" is the viewer's local calendar date, which the server cannot know — so the server renders
 * a placeholder and the browser draws the timeline, rather than hydrating one drawn in the server's
 * timezone and shifting it a day for anyone east or west of it.
 */
function useLocalToday(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => localToday(new Date()),
    () => null,
  )
}

/** The zoom, as URL state; the default is left out of the URL. */
function useZoom() {
  const params = useSearchParams()
  const zoom = readZoom(params.get('zoom'))

  const setZoom = (next: Zoom) => {
    const merged = new URLSearchParams(params)
    if (next === DEFAULT_ZOOM) merged.delete('zoom')
    else merged.set('zoom', next)
    const query = merged.toString()
    // The native history API keeps the router's search params in step without a server round trip:
    // the window is drawn from data already on the page.
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }

  return [zoom, setZoom] as const
}

function ZoomSwitch({ value, onChange }: { value: Zoom; onChange: (zoom: Zoom) => void }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a form fieldset
    <div role="group" aria-label="Zoom" className="inline-flex rounded-md bg-muted p-0.5">
      {ZOOMS.map((zoom) => (
        <button
          key={zoom}
          type="button"
          aria-pressed={zoom === value}
          onClick={() => onChange(zoom)}
          className={cn(
            'rounded-sm px-3 py-1 text-[13px] text-muted-foreground hover:text-foreground',
            zoom === value && 'bg-card font-semibold text-foreground shadow-xs',
          )}
        >
          {ZOOM_LABELS[zoom]}
        </button>
      ))}
    </div>
  )
}

/** The track's faint column rules, and in the header row the column labels. */
function Columns({ range, labelled = false }: { range: RoadmapWindow; labelled?: boolean }) {
  return (
    <div
      className="absolute inset-0 grid"
      style={{ gridTemplateColumns: `repeat(${range.columns.length}, minmax(0, 1fr))` }}
      aria-hidden={labelled ? undefined : true}
    >
      {range.columns.map((column) => (
        <span key={column.key} className="border-l border-border/70 pt-2 pl-1.5">
          {labelled ? <Meta caps>{column.label}</Meta> : null}
        </span>
      ))}
    </div>
  )
}

const ROW = 'grid min-h-12 grid-cols-[260px_minmax(0,1fr)] items-center border-b last:border-b-0'

function SprintRow({ sprint, range }: { sprint: Sprint; range: RoadmapWindow }) {
  const span = spanIn(range, sprint.startDate, sprint.endDate)
  if (span === null) return null

  const label = `${sprint.doneCount} / ${sprint.issueCount} DONE`
  const bar = cn(
    '@container absolute top-3 flex h-6 items-center rounded-sm font-mono text-[10.5px] font-medium whitespace-nowrap',
    sprint.state === 'Active' && 'border border-primary bg-accent text-foreground',
    sprint.state === 'Planned' &&
      'border border-dashed border-muted-foreground bg-card text-foreground',
    sprint.state === 'Completed' && 'bg-muted text-muted-foreground',
  )
  // A sprint one day long in Quarters is still a mark you can see.
  const style = { left: `${span.left}%`, width: `max(${span.width}%, 6px)` }
  const dates = `${sprint.startsOn} – ${sprint.endsOn}`
  // Inside the bar when it fits; beside it when the bar is too short for its words (a two-week
  // sprint in Quarters), so the bar keeps its true length rather than stretching to fit the text.
  // Beside means before the bar when it ends near the right edge, where after would overflow.
  const besideBefore = span.left + span.width > 85
  const text = (
    <>
      <span className="hidden px-2 @min-[6.5rem]:inline">{label}</span>
      <span
        className={cn(
          'absolute @min-[6.5rem]:hidden',
          besideBefore ? 'right-full mr-1.5' : 'left-full ml-1.5',
        )}
      >
        {label}
      </span>
    </>
  )

  return (
    <li className={ROW}>
      <div className="flex min-w-0 items-center gap-2 px-4 text-[13px]">
        <span className="truncate" title={sprint.name}>
          {sprint.name}
          {sprint.state === 'Active' ? null : (
            <span className="sr-only">, {sprint.state.toLowerCase()}</span>
          )}
        </span>
        {sprint.state === 'Active' ? (
          <Meta caps className="text-primary">
            Active
          </Meta>
        ) : null}
      </div>
      <div className="relative h-full min-h-12">
        <Columns range={range} />
        {sprint.state === 'Active' ? (
          <Link
            href="/delivery/sprint"
            className={cn(bar, 'no-underline hover:bg-accent/70')}
            style={style}
            title={dates}
            aria-label={`${sprint.name}, ${label.toLowerCase()} — open the Sprint board`}
          >
            {text}
          </Link>
        ) : (
          <span className={bar} style={style} title={`${sprint.name}, ${dates}`}>
            {text}
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * The Roadmap's zoom and timeline: the column header, the TODAY rule, and the Sprints group of rows
 * (`SPEC/20-feature-issues-and-delivery.md`, "Roadmap (comp R)"). Outcome rows join it when
 * Outcomes are built.
 */
export function RoadmapTimeline({ sprints }: { sprints: readonly Sprint[] }) {
  const [zoom, setZoom] = useZoom()
  const today = useLocalToday()

  const range = today === null ? null : roadmapWindow(zoom, today)
  const visible =
    range === null
      ? []
      : sprints
          .filter((sprint) => spanIn(range, sprint.startDate, sprint.endDate) !== null)
          .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))

  return (
    <>
      {/* `ml-auto` rather than `justify-end`, so a narrow screen overflows to the right. */}
      <div className="flex">
        <div className="ml-auto">
          <ZoomSwitch value={zoom} onChange={setZoom} />
        </div>
      </div>

      <section aria-label="Timeline" className="overflow-x-auto rounded-lg border bg-card">
        {range === null || today === null ? (
          <SkeletonRegion label="Loading timeline" className="m-4">
            <Skeleton className="h-24" />
          </SkeletonRegion>
        ) : (
          <div className="relative min-w-[760px] pb-6">
            {/* First, so the bars paint over it. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
              style={{
                left: `calc(260px + (100% - 260px) * ${positionIn(range, dayNumber(today)) / 100})`,
              }}
            >
              <Meta caps className="absolute bottom-1 left-1 text-primary">
                Today
              </Meta>
            </div>
            <div className={cn(ROW, 'min-h-8')}>
              <span className="px-4">
                <Meta caps>Sprints</Meta>
              </span>
              <div className="relative h-full min-h-8">
                <Columns range={range} labelled />
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="m-0 px-4 py-3 text-sm text-muted-foreground">
                No sprints in this window.
              </p>
            ) : (
              <ul aria-label="Sprints" className="m-0 list-none p-0">
                {visible.map((sprint) => (
                  <SprintRow key={sprint.id} sprint={sprint} range={range} />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  )
}
