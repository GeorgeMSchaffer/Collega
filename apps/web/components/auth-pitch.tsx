import { Kbd } from '@collega/design-system'
import type { ReactNode } from 'react'

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="mt-px shrink-0 text-primary"
    >
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
    </svg>
  )
}

/**
 * A schematic board — five lanes in status hues with placeholder cards — so the panel shows what
 * Collega is rather than a block of colour. Decorative: it says nothing the copy does not. Every
 * hue is a theme token, so it reads in each of the five themes.
 */
const LANES: { label: string; dot: string; cards: (string | null)[] }[] = [
  { label: 'New', dot: 'bg-muted-foreground', cards: ['bg-warning', 'bg-success', null] },
  { label: 'Review', dot: 'bg-warning', cards: ['bg-destructive', null] },
  { label: 'Doing', dot: 'bg-suggest', cards: ['bg-warning', null] },
  { label: 'Client', dot: 'bg-primary', cards: ['bg-destructive'] },
  { label: 'Done', dot: 'bg-success', cards: [null, 'bg-success', null] },
]

function BoardPreview() {
  return (
    <div aria-hidden="true" className="mt-10 grid w-full max-w-[520px] grid-cols-5 gap-2">
      {LANES.map((lane) => (
        <div
          key={lane.label}
          className="flex min-h-[170px] flex-col gap-1.5 rounded-lg border border-sidebar-border bg-background p-1.5"
        >
          <div className="flex items-center gap-1.5 overflow-hidden px-0.5 font-mono text-[10px] text-muted-foreground">
            <span className={`size-1.5 shrink-0 rounded-full ${lane.dot}`} />
            {lane.label}
          </div>
          {lane.cards.map((chip, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, non-reordering decorative list
            <div key={i} className="flex flex-col gap-1 rounded-md border bg-card p-1.5">
              <span className="block h-[5px] rounded-full bg-muted" />
              <span className="block h-[5px] w-[70%] rounded-full bg-muted" />
              {chip ? <span className={`block h-1 w-6 rounded-full ${chip}`} /> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * The left column, on the sidebar's ground rather than the primary colour (sign-in comp
 * `SPEC/mockups/comp-login-alternatives.html`, option C, chosen 2026-10-04): a full-height block of
 * primary was half the screen in Graphite's amber beside a near-black form. The primary is kept for
 * the mark and the checks. `points` is optional — the password-change screen has none — and
 * `preview` adds the schematic board, which only the sign-in screen shows.
 */
export function AuthPitch({
  heading,
  children,
  points,
  preview = false,
}: {
  heading: string
  children: ReactNode
  points?: ReactNode[]
  preview?: boolean
}) {
  return (
    <div className="hidden flex-col justify-center border-r border-sidebar-border bg-sidebar px-14 py-16 text-foreground lg:flex">
      <div className="mb-6 flex size-9 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        CG
      </div>
      <h2 className="mb-4 max-w-[17ch] text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className="mb-6 max-w-[48ch] text-base leading-relaxed text-muted-foreground [&_p]:m-0">
        {children}
      </div>
      {points ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {points.map((point, i) => (
            // Static copy in source order; there is no id to key on and the list never reorders.
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, non-reordering static list
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-snug">
              <Check />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {preview ? <BoardPreview /> : null}
    </div>
  )
}

export { Kbd }
