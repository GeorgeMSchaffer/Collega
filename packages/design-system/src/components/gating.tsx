"use client";

import * as React from "react";

import { cn } from "../lib/utils";

/**
 * The role and state mechanisms, carried over from the comps.
 *
 * Comp Q expresses both in CSS, because it has no runtime: `data-role` on <body> against
 * `data-roles` on an element, and `data-state` on a `.screen` against `data-when`, both
 * hiding the non-matching case with `display: none !important`.
 *
 * Here they are conditional rendering instead, for two reasons. Hidden-but-present markup
 * is still in the accessibility tree in ways `display:none` only mostly suppresses, and it
 * still runs its own effects and fetches. And the comps' own build notes record the two
 * bugs the CSS approach produced — a gated control rendering twice because only one side
 * was tagged, and a grid track keeping its width after its only child was hidden. Neither
 * is expressible here: an unmatched branch is not in the tree at all.
 *
 * The `data-*` attributes are still emitted, so e2e selectors and screenshots can assert
 * which state a screen is in.
 */

export const ROLES = ["SiteAdmin", "OrgAdmin", "User", "ReadOnly"] as const;
export type Role = (typeof ROLES)[number];

export const SCREEN_STATES = ["normal", "empty", "loading", "error"] as const;
export type ScreenState = (typeof SCREEN_STATES)[number];

const RoleContext = React.createContext<Role | null>(null);
const ScreenStateContext = React.createContext<ScreenState>("normal");

/** Publishes the viewer's role to everything below it. Set once, in the desk shell. */
function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

function useRole(): Role {
  const role = React.useContext(RoleContext);
  if (!role) throw new Error("useRole must be used within a <RoleProvider>");
  return role;
}

/**
 * Renders its children only for the listed roles.
 *
 * Gating the UI is a convenience, never the authorization. The server decides; this only
 * keeps a viewer from being shown a control they cannot use.
 */
function ForRoles({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const role = useRole();
  return roles.includes(role) ? <>{children}</> : null;
}

/**
 * A screen, at one of four states. Wrap the page body; put `<When>` around the parts that
 * belong to particular states.
 */
function Screen({
  state = "normal",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { state?: ScreenState }) {
  return (
    <ScreenStateContext.Provider value={state}>
      <div
        data-slot="screen"
        data-screen-state={state}
        // Loading and error are announced, so a state change is not silent for a screen
        // reader. aria-busy is what tells assistive tech the skeletons are placeholders.
        aria-busy={state === "loading" || undefined}
        className={cn("min-w-0", className)}
        {...props}
      >
        {children}
      </div>
    </ScreenStateContext.Provider>
  );
}

function useScreenState(): ScreenState {
  return React.useContext(ScreenStateContext);
}

/** Renders its children only in the listed screen states. */
function When({
  state,
  children,
}: {
  state: ScreenState | readonly ScreenState[];
  children: React.ReactNode;
}) {
  const current = useScreenState();
  const wanted = Array.isArray(state) ? state : [state as ScreenState];
  return wanted.includes(current) ? <>{children}</> : null;
}

export { ForRoles, RoleProvider, Screen, useRole, useScreenState, When };
