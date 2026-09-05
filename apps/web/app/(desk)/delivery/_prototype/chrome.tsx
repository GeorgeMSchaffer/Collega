"use client";

/**
 * The shared parts of the delivery prototype: the label that says what these screens are, and
 * the small pieces of vocabulary the four of them draw the same way.
 *
 * The strip is the point of this module. Everything else in the desk is anchored to the golden
 * corpus, and a reviewer moving from Ideas to Roadmap has to be able to tell instantly that one
 * is a recording and the other is a drawing. Nothing here may be softened to make a screenshot
 * look finished — that is the whole job.
 */

import {
  Avatar,
  AvatarFallback,
  AvatarStack,
  Badge,
  DeniedAction,
  cn,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
import { initialsOf } from "@/lib/format";
import { useActivateOnSpace } from "@/lib/keys";

import {
  SAMPLE_EFFORT_COLORS,
  SAMPLE_SPRINT_STATE_COLORS,
  SAMPLE_STATUS_COLORS,
  type SampleDeliveryStatus,
  type SampleEffort,
  type SampleIssue,
  type SampleSprintState,
} from "@/app/(desk)/delivery/_prototype/sample-data";

/**
 * The band every delivery screen opens with.
 *
 * Modelled on the View As banner — persistent, non-dismissable, its meaning carried by the
 * words rather than the colour — and given a different ground so the two are never confused.
 * Comp Q ships the same idea as its *Not built* strip; this one says the additional thing the
 * comp did not have to: that the data is invented, and where the invention lives.
 *
 * It is a landmark rather than a live region. A `role="status"` here would re-announce on every
 * navigation between the four screens, which is nagging rather than informing.
 */
export function PrototypeStrip() {
  return (
    <section
      aria-label="Design prototype notice"
      data-testid="delivery-prototype-strip"
      className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-2.5 text-white md:px-6 [&_code]:rounded-sm [&_code]:bg-white/20 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.95em] [&_code]:text-white"
      style={{ backgroundColor: "var(--purple-deep)" }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0"
      >
        <path d="M10 1.6 2 6.1v7.8l8 4.5 8-4.5V6.1Zm0 2.3 5.6 3.1L10 10.2 4.4 7Zm-6.2 4.5 5.4 3v5.3l-5.4-3Zm12.4 0v5.3l-5.4 3v-5.3Z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm leading-tight">
          <strong className="font-bold">Design prototype — not working software.</strong>
        </p>
        <p className="m-0 mt-0.5 text-xs leading-snug">
          Delivery is specified in <code>SPEC/20-feature-issues-and-delivery.md</code> and has not been
          built. It has <strong className="font-bold">no recordings in the golden corpus</strong> and no
          API behind it, so every issue, sprint, outcome, person and number on these four screens is
          illustrative sample data written by hand in{" "}
          <code>app/(desk)/delivery/_prototype/sample-data.ts</code>. Controls that respond here change
          what you see in this tab and save nothing; a reload puts it all back.
        </p>
      </div>
    </section>
  );
}

/**
 * A control the prototype deliberately does not honour.
 *
 * The alternative — a button that looks live and silently does nothing — is the thing the strip
 * exists to prevent, one control at a time. `DeniedAction` keeps the tab stop and reads the
 * reason out on focus, so this is not a colour-only difference either.
 */
export function PrototypeAction({
  reason = "Prototype — nothing is saved",
  className,
  children,
}: {
  reason?: string;
  className?: string;
  children: (props: { "aria-disabled": true; "aria-describedby": string }) => React.ReactNode;
}) {
  return (
    <DeniedAction reason={reason} className={className}>
      {children}
    </DeniedAction>
  );
}

/** The mono key chip from the comps. Never breaks across lines. */
export function IssueKey({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block shrink-0 rounded-sm border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums">
      {children}
    </span>
  );
}

export function StatusMarker({ status, className }: { status: SampleDeliveryStatus; className?: string }) {
  return (
    <Marker color={SAMPLE_STATUS_COLORS[status]} className={className}>
      {status}
    </Marker>
  );
}

/** Always the word "effort" as well as the size — "Medium" alone reads as a priority. */
export function EffortMarker({
  effort,
  withNoun,
  className,
}: {
  effort: SampleEffort;
  withNoun?: boolean;
  className?: string;
}) {
  return (
    <Marker color={SAMPLE_EFFORT_COLORS[effort]} className={className}>
      {withNoun ? `${effort} effort` : effort}
    </Marker>
  );
}

export function SprintStateMarker({ state, className }: { state: SampleSprintState; className?: string }) {
  return (
    <Marker color={SAMPLE_SPRINT_STATE_COLORS[state]} className={className}>
      {state}
    </Marker>
  );
}

/**
 * `N of M done`, with a bar behind it.
 *
 * The count is the meaning and the bar is decoration, so the bar is `aria-hidden` and the
 * sentence is what a screen reader gets. `SPEC/20-feature-issues-and-delivery.md` is explicit
 * that this rollup counts only `Done` and must never be read as a velocity or capacity proxy.
 */
export function TaskProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">No tasks</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs tabular-nums text-muted-foreground">
        Tasks {done} of {total} done
      </span>
      <span aria-hidden="true" className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </span>
    </span>
  );
}

/** Initials for the sample data's plain-string names. */
export function SampleAvatars({ names }: { names: readonly string[] }) {
  if (names.length === 0) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <AvatarStack aria-label={`Assigned to ${names.join(", ")}`}>
      {names.map((name) => {
        const [first, last] = name.split(" ");
        return (
          <Avatar key={name}>
            <AvatarFallback>{initialsOf(first ?? null, last ?? null)}</AvatarFallback>
          </Avatar>
        );
      })}
    </AvatarStack>
  );
}

/** One card in a sprint-board lane. The title is the control, and it answers Space as well. */
export function IssueCard({
  issue,
  done,
  total,
  className,
}: {
  issue: SampleIssue;
  done: number;
  total: number;
  className?: string;
}) {
  const activateOnSpace = useActivateOnSpace();

  return (
    <article className={cn("rounded-md border bg-card p-2.5 shadow-xs", className)}>
      <div className="flex items-start gap-2">
        <IssueKey>{issue.key}</IssueKey>
        <Link
          href={`/delivery/issues/${issue.key}`}
          onKeyDown={activateOnSpace}
          className="min-w-0 text-sm font-medium text-foreground hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          {issue.title}
        </Link>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <EffortMarker effort={issue.effort} withNoun className="text-xs" />
        <span className="ml-auto shrink-0">
          <SampleAvatars names={issue.assignees} />
        </span>
      </div>

      <div className="mt-2">
        <TaskProgress done={done} total={total} />
      </div>
    </article>
  );
}

/** The tag row the comps put under an issue's facts. */
export function TagRow({ tags }: { tags: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {[...tags].sort().map((tag) => (
        <li key={tag}>
          <Badge variant="outline">{tag}</Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * The two-column facts grid the comps use for Delivery and Provenance.
 *
 * A `<dl>` rather than a table: these are name/value pairs, not rows of a set.
 */
export function Facts({ children }: { children: React.ReactNode }) {
  return <dl className="m-0 grid grid-cols-[minmax(84px,auto)_1fr] gap-x-4 gap-y-2 text-sm">{children}</dl>;
}

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  );
}
