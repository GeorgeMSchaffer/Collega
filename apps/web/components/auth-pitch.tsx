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
      className="mt-px shrink-0 text-[var(--sky)]"
    >
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
    </svg>
  )
}

/** The left column. `points` is optional — the password-change screen deliberately has none. */
export function AuthPitch({
  heading,
  children,
  points,
}: {
  heading: string
  children: ReactNode
  points?: ReactNode[]
}) {
  return (
    <div className="hidden flex-col justify-center bg-primary px-14 py-16 text-primary-foreground lg:flex">
      <div className="mb-6 flex size-9 items-center justify-center rounded-md bg-white/15 text-xs font-bold">
        CG
      </div>
      <h2 className="mb-4 max-w-[17ch] text-2xl font-semibold tracking-tight text-white">
        {heading}
      </h2>
      <div className="mb-6 max-w-[48ch] text-base leading-relaxed text-white/80 [&_p]:m-0">
        {children}
      </div>
      {points ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {points.map((point, i) => (
            // Static copy in source order; there is no id to key on and the list never reorders.
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, non-reordering static list
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-snug text-white/90">
              <Check />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export { Kbd }
