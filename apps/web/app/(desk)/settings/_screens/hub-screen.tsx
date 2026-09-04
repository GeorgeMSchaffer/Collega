"use client";

/**
 * `/settings` — the hub.
 *
 * Comp P: *"The hub is a role map, not a menu."* A Site Admin sees nine sections, an Org
 * Admin seven, and a member exactly one. The two admin sets overlap in name but not in
 * meaning — a Site Admin's **Manage Statuses** is a cross-organization roll-up that leads
 * into a chosen organization, while an Org Admin's goes straight to their own.
 *
 * This is the one place `SPEC/20-feature-client-ui.md` allows something to be *hidden*
 * rather than refused: "admin links a member has no business seeing on the Settings hub" are
 * one of the two exceptions to denied-is-shown. So a member gets Profile and a sentence
 * saying the rest is absent by design, not a grid of dead cards.
 */

import { Badge, Card, CardContent, Screen, Skeleton, When, type ScreenState } from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { ErrorNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import type { Role } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

interface Section {
  readonly title: string;
  readonly href: string;
  readonly blurb: string;
  readonly tag?: string;
  readonly roles: readonly Role[];
}

/**
 * Written out per role rather than shared, because the copy differs where the meaning does.
 * The Site Admin's cards say "then open one to manage it"; the Org Admin's do not, because
 * theirs land on their own organization directly.
 */
const SECTIONS: readonly Section[] = [
  {
    title: "My Profile",
    href: "/settings/profile",
    blurb: "Update your name and password.",
    roles: ["SiteAdmin", "OrgAdmin", "User", "ReadOnly"],
  },

  {
    title: "Organizations",
    href: "/settings/organizations",
    blurb: "Create organizations and manage each organization’s configuration.",
    roles: ["SiteAdmin"],
  },
  {
    title: "Manage Users",
    href: "/settings/users",
    blurb: "View users across every organization, then open one to manage it.",
    tag: "Cross-org",
    roles: ["SiteAdmin"],
  },
  {
    // Leaves Settings on purpose: a Site Admin reads boards from the workspace list, because
    // board administration is organization-scoped and they belong to none.
    title: "Boards",
    href: "/boards",
    blurb:
      "View boards across every organization, then open one to work with it. This one leaves Settings.",
    tag: "Workspace",
    roles: ["SiteAdmin"],
  },
  {
    title: "Manage Statuses",
    href: "/settings/statuses",
    blurb: "View statuses across every organization, then open one to manage it.",
    tag: "Cross-org",
    roles: ["SiteAdmin"],
  },
  {
    title: "Manage Idea Types",
    href: "/settings/idea-types",
    blurb: "View idea types across every organization, then open one to manage it.",
    tag: "Cross-org",
    roles: ["SiteAdmin"],
  },
  {
    title: "Manage User-Defined Fields",
    href: "/settings/fields",
    blurb: "View fields across every organization, then open one to manage it.",
    tag: "Cross-org",
    roles: ["SiteAdmin"],
  },

  {
    title: "Manage Users",
    href: "/settings/users",
    blurb: "Create, edit, and import users in your organization.",
    roles: ["OrgAdmin"],
  },
  {
    title: "Manage Boards",
    href: "/settings/boards",
    blurb: "Create and configure boards in your organization.",
    roles: ["OrgAdmin"],
  },
  {
    title: "Manage Statuses",
    href: "/settings/statuses",
    blurb: "Configure the statuses used by your organization’s boards.",
    roles: ["OrgAdmin"],
  },
  {
    title: "Manage Idea Types",
    href: "/settings/idea-types",
    blurb: "Configure the idea types your organization files ideas under.",
    roles: ["OrgAdmin"],
  },
  {
    title: "Manage User-Defined Fields",
    href: "/settings/fields",
    blurb: "Configure the fields your organization captures on ideas.",
    roles: ["OrgAdmin"],
  },

  {
    title: "AI Assist",
    href: "/settings/ai-assist",
    blurb: "Tune an organization’s assistant scope. Act as a member to configure theirs.",
    roles: ["SiteAdmin"],
  },
  {
    title: "AI Assist",
    href: "/settings/ai-assist",
    blurb: "Tune what the idea assistant will and won’t discuss for your organization.",
    roles: ["OrgAdmin"],
  },
  {
    title: "API",
    href: "/settings/api-usage",
    blurb: "AI assist token usage and cost by organization, against the daily limit.",
    roles: ["SiteAdmin"],
  },
  {
    title: "API",
    href: "/settings/api-usage",
    blurb: "Your organization’s AI assist token usage and estimated cost.",
    roles: ["OrgAdmin"],
  },
  {
    title: "AI Prompt",
    href: "/settings/ai-prompt",
    blurb:
      "Edit the assistant’s instructions for every organization, with history and rollback.",
    tag: "Site Admin only",
    roles: ["SiteAdmin"],
  },
];

export function HubScreen() {
  const { me, meError, stateOverride } = useWorkspace();
  const role = me?.role;

  const sections = React.useMemo(
    () => (role === undefined ? [] : SECTIONS.filter((section) => section.roles.includes(role))),
    [role],
  );

  const state: ScreenState = stateOverride ?? (meError ? "error" : me ? "normal" : "loading");
  const isMember = role === "User" || role === "ReadOnly";

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Settings" }]} />
      <DeskWork>
        <PageHeader title="Settings">Manage your profile and organization configuration.</PageHeader>

        <Screen state={state} data-testid="settings-hub">
          <When state="loading">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <span className="sr-only">Loading</span>
              {Array.from({ length: 6 }, (_, index) => (
                <Card key={index}>
                  <CardContent className="flex flex-col gap-2.5">
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </When>

          <When state="error">
            <ErrorNotice
              error={meError}
              what="your settings"
              // No retry: the identity is the shell's request, not this screen's, and a
              // button here that cannot reach it would be a lie about what it does.
            />
          </When>

          <When state={["normal", "empty"]}>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((section) => (
                <li key={`${section.title}-${section.href}`} className="min-w-0">
                  {/* `relative` is what the title link's `after:inset-0` overlay is measured
                      against: the whole card becomes the hit area, while the accessible name
                      and the tab stop stay on the one link. */}
                  <Card className="relative h-full transition-colors hover:bg-accent/40 focus-within:ring-1 focus-within:ring-ring">
                    <CardContent className="flex h-full flex-col gap-1.5">
                      <Link
                        href={section.href}
                        className="font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {section.title}
                      </Link>
                      {section.tag ? (
                        <Badge variant="outline" className="w-fit">
                          {section.tag}
                        </Badge>
                      ) : null}
                      <p className="m-0 text-sm text-muted-foreground">{section.blurb}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>

            {isMember ? (
              <p className="mt-6 mb-0 max-w-prose rounded-lg border-l-4 border-l-secondary bg-muted/40 px-4 py-3 text-sm leading-relaxed">
                <strong>Settings is almost entirely administrative.</strong> You see only your
                own profile here. Everything else — users, boards, statuses, idea types, fields
                and the assistant — is configured by an organization administrator, so it is
                absent rather than refused.
              </p>
            ) : null}
          </When>
        </Screen>
      </DeskWork>
    </>
  );
}
