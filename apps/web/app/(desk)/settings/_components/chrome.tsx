"use client";

/**
 * The pieces every settings screen is assembled from.
 *
 * Comp P generates its twenty-three admin screens from a handful of macros — `guard`,
 * `scope_bar`, `table_editor`, the read-only side card — for a reason it states out loud:
 * `/settings/statuses` and `/settings/organizations/{id}/statuses` are the *same component*
 * at two routes, and two hand-written copies drift on the first edit. These are those
 * macros, as components.
 *
 * The distinction the guard keeps visible is the one `SPEC/20-feature-client-ui.md` draws
 * (2026-09-02): a refused **action** renders disabled with its reason attached; a refused
 * **route** renders a short refusal panel, never the live page with every control dead.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  DeniedAction,
  Empty,
  EmptyDescription,
  EmptyTitle,
  cn,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { USE_MOCK_API } from "@/mocks";

import { CorpusNote } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import type { Role } from "@/lib/types";

import { useSubmit, type MockDiagnostics, type SubmitState } from "@/app/(desk)/settings/_lib/api";
import { mayOpen, refusalReason, type MutationScope, type RouteAudience } from "@/app/(desk)/settings/_lib/rules";

/** The two-column body comp P uses on every list screen: the table, then a side card. */
export function Cols({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">{children}</div>
      {aside ? <div className="w-full shrink-0 xl:w-[356px]">{aside}</div> : null}
    </div>
  );
}

/**
 * The route-level role gate.
 *
 * Renders the whole screen as a refusal for roles the route is closed to, and the children
 * for the rest. `audience` is the route's, not the action's — a route a viewer may read but
 * not change passes through here and refuses at its controls instead.
 */
export function SettingsGuard({
  role,
  audience,
  /** What the route configures — "statuses", "boards", "the user import". */
  subject,
  back = { href: "/settings", label: "Back to Settings" },
  children,
}: {
  role: Role | undefined;
  audience: RouteAudience;
  subject: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  // Nothing until the API has said who is looking: a refusal shown to the wrong person for
  // the length of a round trip reads as a bug, and is worse than a moment of blankness.
  if (role === undefined) return null;
  if (mayOpen(role, audience)) return <>{children}</>;

  const siteAdminOnly = audience === "site-admin";
  return (
    <>
      <PageHeader title="Not available">This route is closed to your role.</PageHeader>
      <Empty>
        <EmptyTitle>{siteAdminOnly ? "Site Admins only" : "Administrators only"}</EmptyTitle>
        <EmptyDescription>
          {siteAdminOnly ? (
            <>
              The organization-scoped route exists so a Site Admin can inspect an organization
              they do not belong to. Your own organization’s {subject} live under Settings.
            </>
          ) : (
            <>
              Configuring {subject} is an administrator’s job, so this route is closed to
              members. Nothing here is hidden from you selectively — the whole page is out of
              scope for your role.
            </>
          )}
        </EmptyDescription>
        <Button variant="outline" asChild className="mt-4">
          <Link href={back.href}>{back.label}</Link>
        </Button>
      </Empty>
    </>
  );
}

/**
 * The banner every organization-scoped screen carries.
 *
 * A Site Admin reading an organization they are not a member of is the one place in the
 * product where *which organization am I looking at?* is not answerable from the sidebar,
 * which shows "All organizations". So the page says it.
 */
export function ScopeNote({
  organizationName,
  back,
}: {
  organizationName: string;
  back: { href: string; label: string };
}) {
  return (
    <Alert role="note" className="mb-4 border-l-4 border-l-secondary">
      <AlertTitle>Viewing {organizationName}</AlertTitle>
      <AlertDescription>
        You reached this page from the cross-organization list, so everything below belongs to{" "}
        {organizationName} and to no other organization.{" "}
        <Link href={back.href} className="font-medium underline underline-offset-2">
          {back.label}
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}

/**
 * A mutating control, live or refused.
 *
 * Every mutating control on these screens goes through here rather than deciding for itself,
 * so that adding a surface without consulting the rule is visible in review. `DeniedAction`
 * is the frozen pattern: `aria-disabled` with `aria-describedby`, never the `disabled`
 * attribute, which would take the control out of the tab order and the explanation with it.
 */
export function Guarded({
  role,
  scope,
  quiet = false,
  children,
  className,
}: {
  role: Role | undefined;
  scope: MutationScope;
  /**
   * For a control repeated once per table row. The reason is still a real element the
   * control points at with `aria-describedby`, so it is announced on focus — it is only
   * hidden from sight, because five identical sentences down an Edit column is noise. The
   * screen states it once in the table footer for whoever is reading rather than listening.
   */
  quiet?: boolean;
  className?: string;
  children: (denied: { "aria-disabled": true; "aria-describedby": string } | null) => React.ReactNode;
}) {
  const reason = refusalReason(role, scope);
  if (role === undefined) return null;
  if (reason === null) return <>{children(null)}</>;
  return (
    <DeniedAction
      reason={quiet ? <span className="sr-only">{reason}</span> : reason}
      className={cn(quiet ? "gap-0" : "flex-wrap", className)}
    >
      {(denied) => children(denied)}
    </DeniedAction>
  );
}

/**
 * The side card an organization-scoped screen shows a Site Admin instead of its create form.
 *
 * Comp P's *"Why is this read-only?"*. The **Prove it** control is the one thing the comp
 * has no equivalent for, and it is scaffolding rather than product: it fires the real
 * refused request so the rule can be *seen* refusing rather than asserted by a dimmed
 * button. `SPEC/20-feature-view-as.md` rule 25 was route-shaped in the Blazor client and a
 * review found two unguarded paths past it, so being able to check the server agrees — from
 * the screen, at the role, in one click — is worth a scaffolding control.
 */
export function ReadOnlyAside({
  subject,
  probe,
}: {
  subject: string;
  probe?: { method: string; path: string; body?: unknown };
}) {
  const probeOutcome = useSubmit<unknown>();

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight">Why is this read-only?</h2>
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">
          A Site Admin can read every organization’s {subject} and change none of them. Use
          View As to act as a member of this organization, and the same controls become live.
        </p>
        <Guarded role="SiteAdmin" scope="org-content">
          {(denied) => (
            <Button variant="outline" className="w-fit" {...(denied ?? {})}>
              Open View As
            </Button>
          )}
        </Guarded>
        {/* Scaffolding, and gated so it cannot outlive the mock: it fires a real refused
            mutation, which is exactly what nobody wants on a production admin screen. */}
        {probe && USE_MOCK_API ? (
          <>
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Recorded data</span> — the control
              below is scaffolding, not part of the product. It fires the real refused request
              so the rule can be seen refusing rather than taken on trust.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => void probeOutcome.send(probe.method, probe.path, probe.body)}
            >
              Ask the API to change it anyway
            </Button>
            <ProbeOutcome outcome={probeOutcome} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProbeOutcome({ outcome }: { outcome: SubmitState<unknown> }) {
  if (outcome.state === "idle") return null;
  if (outcome.state === "sending") {
    return (
      <p role="status" className="m-0 text-xs text-muted-foreground">
        Asking…
      </p>
    );
  }
  if (outcome.state === "refused") {
    return (
      <Alert variant="warning" role="status">
        <AlertTitle>
          The API refused it — {outcome.error?.status} {outcome.error?.problem?.title}
        </AlertTitle>
        <AlertDescription>{outcome.error?.problem?.detail}</AlertDescription>
      </Alert>
    );
  }
  if (outcome.state === "failed") {
    return outcome.error?.isMockGap ? (
      <CorpusNote>{outcome.error.message}</CorpusNote>
    ) : (
      <Alert variant="destructive">
        <AlertTitle>The request failed.</AlertTitle>
        <AlertDescription>{outcome.error?.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert role="status">
      <AlertTitle>The API allowed it.</AlertTitle>
      <AlertDescription>
        That contradicts rule 25 — a Site Admin should never be able to change organization
        content directly. Worth raising before this reaches Nest.
      </AlertDescription>
    </Alert>
  );
}

/**
 * What a screen says when the mock answered with a recording of a *different* record.
 *
 * The corpus recorded one organization's configuration and one user's detail. Ask for
 * another organization's statuses and the mock serves Acme's, flagged. Rendering that
 * silently would put one tenant's data under another tenant's name, which on an
 * administration screen is the worst possible place to be quietly wrong.
 */
export function SubstitutionNote({
  mock,
  what,
  className,
}: {
  mock: MockDiagnostics | null;
  what: string;
  className?: string;
}) {
  if (mock?.match !== "substituted") return null;
  return (
    <CorpusNote className={className}>
      the corpus recorded {what} for one organization only. What is shown below was recorded
      at <code className="font-mono">{mock.recordedPath}</code> and is standing in — it is
      not this organization’s data.
    </CorpusNote>
  );
}

/** The outcome of a create or a destructive action, in the three voices it can have. */
export function SubmitOutcome({
  outcome,
  what,
  className,
}: {
  outcome: SubmitState<unknown>;
  what: string;
  className?: string;
}) {
  if (outcome.state === "idle" || outcome.state === "sending") return null;

  if (outcome.state === "refused") {
    return (
      <Alert variant="warning" role="status" className={className}>
        <AlertTitle>{outcome.error?.problem?.title ?? "Refused"}</AlertTitle>
        <AlertDescription>
          {outcome.error?.problem?.detail ?? `The API refused to ${what} for your role.`}
        </AlertDescription>
      </Alert>
    );
  }

  if (outcome.state === "failed") {
    return outcome.error?.isMockGap ? (
      <CorpusNote className={className}>{outcome.error.message}</CorpusNote>
    ) : (
      <Alert variant="destructive" className={className}>
        <AlertTitle>Couldn’t {what}.</AlertTitle>
        <AlertDescription>{outcome.error?.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <CorpusNote className={className}>
      the API answered this {what} with the record it was recorded making, not with what you
      typed — the mock replays a capture, it does not store anything. The list above is the
      recording it already held and does not change.
    </CorpusNote>
  );
}
