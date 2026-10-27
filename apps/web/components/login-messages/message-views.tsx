import { cn } from '@collega/design-system'
import { Fragment, type ReactNode } from 'react'

export type Display = 'Modal' | 'Banner'
export type DismissalMode = 'EveryLogin' | 'DismissOnce' | 'AcknowledgeRequired'
export type Scope = 'System' | 'Organization'

/** Each mode's name, its one-line explanation, and the label of the control that hides it. */
export const MODES: Record<DismissalMode, { name: string; hint: string; close: string }> = {
  EveryLogin: {
    name: 'Every sign-in',
    hint: 'Closing hides it until the next sign-in.',
    close: 'Close',
  },
  DismissOnce: { name: 'Dismiss once', hint: 'Dismissing hides it for good.', close: 'Dismiss' },
  AcknowledgeRequired: {
    name: 'Acknowledge required',
    hint: 'Only Acknowledge hides it for good. Closing brings it back at the next sign-in.',
    close: 'Close',
  },
}

// The last character must not be sentence punctuation, so "see https://x.test/policy." links to `policy`.
const URL_PATTERN = /(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g

/** Plain text with web addresses as links (the form promises it). Line breaks are kept by CSS. */
export function MessageText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed split of immutable text
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline"
          >
            {part}
          </a>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed split of immutable text
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  )
}

function ScopeIcon({ scope }: { scope: Scope }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 flex-none"
    >
      {scope === 'System' ? (
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
      ) : (
        <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3" />
      )}
    </svg>
  )
}

/** The banner strip (comp R): a system message in the warning tint, an organization's in primary. */
export function BannerView({
  scope,
  sourceName,
  title,
  body,
  actions,
}: {
  scope: Scope
  /** "System", or the organization's name. */
  sourceName: string
  title: ReactNode
  body: ReactNode
  actions: ReactNode
}) {
  const system = scope === 'System'
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border border-l-4 py-2.5 pr-3 pl-3.5 text-sm text-foreground max-[700px]:flex-wrap',
        system ? 'border-warning bg-warning/12' : 'border-primary bg-primary/10',
      )}
    >
      <span className={cn('mt-0.5', system ? 'text-warning' : 'text-primary')}>
        <ScopeIcon scope={scope} />
      </span>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'mr-2 inline-block font-mono text-[11px] font-semibold tracking-wide uppercase',
            system ? 'text-warning' : 'text-primary',
          )}
        >
          {sourceName}
        </span>
        <b className="font-semibold">{title}</b>
        <p className="m-0 mt-0.5 whitespace-pre-line text-secondary-foreground">{body}</p>
      </div>
      <span className="flex flex-none items-center gap-2 max-[700px]:w-full max-[700px]:justify-end">
        {actions}
      </span>
    </div>
  )
}

/** The modal's card - heading, body, footer - without the dialog around it, so the preview can use it. */
export function ModalCard({
  scope,
  sourceName,
  title,
  titleId,
  bodyId,
  body,
  closeButton,
  footer,
  preview = false,
}: {
  scope: Scope
  sourceName: string
  title: ReactNode
  titleId?: string
  bodyId?: string
  body: ReactNode
  closeButton: ReactNode
  footer: ReactNode
  preview?: boolean
}) {
  return (
    <div className="flex max-h-[inherit] flex-col">
      <div
        className={cn(
          'flex items-start gap-3',
          preview ? 'px-4 pt-3.5 pb-0.5' : 'px-5 pt-[18px] pb-1',
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
            <ScopeIcon scope={scope} />
            {scope === 'System' ? 'Message from Collega' : `Message from ${sourceName}`}
          </div>
          <h2
            id={titleId}
            className={cn(
              'm-0 mt-1 leading-tight text-balance',
              preview ? 'text-base' : 'text-[19px]',
            )}
          >
            {title}
          </h2>
        </div>
        <span className="ml-auto flex-none">{closeButton}</span>
      </div>
      <div
        id={bodyId}
        className={cn(
          'overflow-auto whitespace-pre-line text-secondary-foreground',
          preview ? 'px-4 pt-1.5 pb-3 text-[13px]' : 'px-5 pt-2 pb-4 text-sm',
        )}
      >
        {body}
      </div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-b-lg border-t bg-muted/60',
          preview ? 'px-4 py-2.5' : 'px-5 py-3',
        )}
      >
        {footer}
      </div>
    </div>
  )
}
