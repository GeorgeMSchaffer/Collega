"use client";

/**
 * The two page shapes every configurable-entity route is one of.
 *
 * `OwnOrgPage` is `/settings/{statuses,idea-types,fields,users,boards}` — an administrator's
 * own organization. A Site Admin belongs to none, so at that role the same route shows the
 * cross-organization roll-up instead, which is why the two are slots rather than a branch
 * inside each screen.
 *
 * `ScopedOrgPage` is `/settings/organizations/{orgId}/…` — a Site Admin reading an
 * organization they are not a member of. Site Admin only, with the banner that names which
 * organization is on screen, because the sidebar cannot: it says *All organizations*.
 *
 * Both own the top bar, the guard and the page head so the twenty-three routes cannot drift
 * apart in their chrome — the drift comp P's build notes warn about, in the one place where
 * a heading that says the wrong organization is a data-safety problem rather than a typo.
 */

import { type ScreenState } from "@collega/design-system";
import * as React from "react";

import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork, type Crumb } from "@/components/nav/desk-top-bar";
import { useApi } from "@/lib/api";
import type { Paged, Role } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

import { ScopeNote, SettingsGuard } from "@/app/(desk)/settings/_components/chrome";
import { mayOpen } from "@/app/(desk)/settings/_lib/rules";
import type { OrganizationRow } from "@/app/(desk)/settings/_lib/types";

export type StateOverride = Exclude<ScreenState, "normal"> | null;

export interface ScreenProps {
  readonly role: Role | undefined;
  readonly organizationId: string | null;
  readonly organizationName: string;
  readonly override: StateOverride;
}

export function OwnOrgPage({
  crumbLabel,
  extraCrumbs,
  subject,
  title,
  standfirst,
  siteAdminTitle,
  siteAdminStandfirst,
  actions,
  orgAdmin,
  siteAdmin,
}: {
  crumbLabel: string;
  /** Crumbs between Settings and this page — the list a create form was reached from. */
  extraCrumbs?: readonly Crumb[];
  /** What the route configures, for the refusal panel: "statuses", "boards". */
  subject: string;
  /** Omit where the screen owns its own heading — the board form's changes with its state. */
  title?: string;
  standfirst?: React.ReactNode;
  /** A Site Admin's heading differs — "All statuses" — because the screen does. */
  siteAdminTitle?: string;
  siteAdminStandfirst?: React.ReactNode;
  actions?: (props: ScreenProps) => React.ReactNode;
  orgAdmin: (props: ScreenProps) => React.ReactNode;
  siteAdmin: (props: ScreenProps) => React.ReactNode;
}) {
  // `organizationId` from the workspace, not from `me`: `GET /auth/me` answers null for a
  // Site Admin, and the two routes that render the same screen for both roles — AI Assist
  // and API usage — would sit in a permanent skeleton under a heading naming an
  // organization. The workspace resolves the one a Site Admin is browsing.
  const { me, organization, organizationId, stateOverride } = useWorkspace();
  const role = me?.role;
  const isSiteAdmin = role === "SiteAdmin";

  const props: ScreenProps = {
    role,
    organizationId,
    organizationName: organization?.title ?? "your organization",
    override: stateOverride,
  };

  return (
    <>
      <DeskTopBar
        crumbs={[
          { label: "Settings", href: "/settings" },
          ...(extraCrumbs ?? []),
          { label: crumbLabel },
        ]}
      >
        {actions?.(props)}
      </DeskTopBar>
      <DeskWork>
        <SettingsGuard role={role} audience="administrators" subject={subject}>
          {title === undefined ? null : (
            <PageHeader title={isSiteAdmin ? (siteAdminTitle ?? title) : title}>
              {isSiteAdmin ? (siteAdminStandfirst ?? standfirst) : standfirst}
            </PageHeader>
          )}
          {isSiteAdmin ? siteAdmin(props) : orgAdmin(props)}
        </SettingsGuard>
      </DeskWork>
    </>
  );
}

export function ScopedOrgPage({
  organizationId,
  crumbLabel,
  subject,
  title,
  standfirst,
  /** The cross-organization list this screen was reached from. */
  rollup,
  orgCrumb,
  scopeNote = true,
  actions,
  children,
}: {
  organizationId: string;
  crumbLabel: string;
  subject: string;
  /** Omit where the screen owns its own heading. */
  title?: string;
  standfirst?: (organizationName: string) => React.ReactNode;
  rollup: { href: string; label: string };
  /** A crumb labelled with the organization's own name — its own scoped list. */
  orgCrumb?: { href: string };
  /** Off where the screen is itself a refusal panel and the banner would only repeat it. */
  scopeNote?: boolean;
  actions?: (props: ScreenProps) => React.ReactNode;
  children: (props: ScreenProps) => React.ReactNode;
}) {
  const { me, stateOverride } = useWorkspace();
  const role = me?.role;

  // The organization's name comes from the platform list, not from
  // `GET /organizations/{id}`: the list is one recording covering every organization, while
  // the detail endpoint was captured against one — so the list is the source that cannot
  // put the wrong name at the top of a page about somebody else's data.
  const organizations = useApi<Paged<OrganizationRow>>(role === "SiteAdmin" ? "/organizations" : null);
  const match = organizations.data?.items.find((one) => one.organizationId === organizationId);
  const organizationName = match?.title ?? "This organization";

  const props: ScreenProps = {
    role,
    organizationId,
    organizationName,
    override: stateOverride,
  };

  return (
    <>
      <DeskTopBar
        crumbs={
          // A trail through pages the viewer cannot open is a trail of dead ends, so a role
          // that is refused this route gets the short honest one instead.
          mayOpen(role, "site-admin")
            ? [
                { label: "Settings", href: "/settings" },
                { label: rollup.label, href: rollup.href },
                ...(orgCrumb ? [{ label: organizationName, href: orgCrumb.href }] : []),
                { label: crumbLabel },
              ]
            : [{ label: "Settings", href: "/settings" }, { label: "Not available" }]
        }
      >
        {mayOpen(role, "site-admin") ? actions?.(props) : null}
      </DeskTopBar>
      <DeskWork>
        <SettingsGuard role={role} audience="site-admin" subject={subject}>
          {title === undefined ? null : (
            <PageHeader title={title}>{standfirst?.(organizationName)}</PageHeader>
          )}
          {scopeNote ? (
            <ScopeNote
              organizationName={organizationName}
              back={{ href: rollup.href, label: `Back to ${rollup.label.toLowerCase()}` }}
            />
          ) : null}
          {children(props)}
        </SettingsGuard>
      </DeskWork>
    </>
  );
}
