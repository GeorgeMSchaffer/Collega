"use client";

/**
 * The one thing every desk screen needs before it can ask anything else: who is looking,
 * and which organization they are looking at.
 *
 * The shape of the corpus decides most of this. `GET /auth/me` carries an `organizationId`
 * for the three member roles and **null** for a Site Admin, who is a platform account; so a
 * Site Admin's organization has to come from `GET /organizations`, which is the one endpoint
 * recorded as a success for that role alone. The organization's *name* comes from
 * `GET /organizations/{id}`, and that endpoint answers **403 to a member and to a read-only
 * account** — "You are not allowed to administer organizations." That refusal is real
 * product behaviour, not a gap, so it is kept as a value here and the screens render it.
 *
 * Boards, statuses and idea types are fetched once here rather than per screen: the board
 * needs statuses for its lanes, the ideas list needs them for its filter, and the command
 * palette needs the boards.
 */

import * as React from "react";

import type { ApiError } from "@/mocks";
import { useApi, type ApiResult, type LoadState } from "@/lib/api";
import type { BoardSummary, IdeaType, Me, Organization, Paged, Status } from "@/lib/types";

export interface Workspace {
  readonly me: Me | null;
  readonly meError: ApiError | null;
  /** Null while unknown, and for a signed-out identity. */
  readonly organizationId: string | null;
  readonly organization: Organization | null;
  /** Set when the API refused the organization record — a member or a read-only account. */
  readonly organizationRefusal: ApiError | null;
  /**
   * How many organizations the platform holds. Only a Site Admin may ask, so it is null for
   * everyone else — and null, not zero, because "not allowed to know" is not "none". It is
   * published here rather than re-fetched by Home: the list is already being read to resolve
   * a Site Admin's `organizationId`, and its total is the same number.
   */
  readonly organizationCount: number | null;
  /**
   * Why the desk cannot be shown at all: no identity, or a Site Admin with no organization
   * to browse. The shell renders this in place of the page rather than every screen sitting
   * in a loading state that will never resolve.
   */
  readonly blocked: { readonly title: string; readonly detail: string } | null;
  /** The board list, shared by the sidebar badge, the command palette and the boards screen. */
  readonly boards: ApiResult<BoardSummary[]>;
  readonly statuses: readonly Status[];
  readonly ideaTypes: readonly IdeaType[];
  /** "loading" until identity and organization are known; "error" if the identity call failed. */
  readonly state: LoadState;
  /**
   * Mock chrome. Comp Q renders every screen at four states and the reviewer picks one; the
   * app has the same control while the mock is what is behind it, so empty, loading and
   * error can be walked without breaking the recordings to reach them.
   */
  readonly stateOverride: "empty" | "loading" | "error" | null;
  readonly setStateOverride: (state: "empty" | "loading" | "error" | null) => void;
}

const WorkspaceContext = React.createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [stateOverride, setStateOverride] = React.useState<Workspace["stateOverride"]>(null);

  const me = useApi<Me>("/auth/me");

  // Only a Site Admin may list organizations; for everyone else the call is a recorded 403,
  // so it is not made at all.
  const isSiteAdmin = me.data?.role === "SiteAdmin";
  const organizations = useApi<Paged<Organization>>(isSiteAdmin ? "/organizations" : null);

  const organizationId =
    me.data?.organizationId ?? (isSiteAdmin ? (organizations.data?.items[0]?.organizationId ?? null) : null);

  const organization = useApi<Organization>(organizationId ? `/organizations/${organizationId}` : null);
  const boards = useApi<BoardSummary[]>(organizationId ? `/organizations/${organizationId}/boards` : null);
  const statuses = useApi<Status[]>(organizationId ? `/organizations/${organizationId}/statuses` : null);
  const ideaTypes = useApi<IdeaType[]>(organizationId ? `/organizations/${organizationId}/idea-types` : null);

  // A Site Admin's organization comes from a list that can come back empty or refused, and
  // an unresolvable organization leaves every org-scoped path null — which reads as a
  // permanent skeleton unless it is called what it is.
  const noOrganization =
    isSiteAdmin && organizationId === null && organizations.state !== "loading"
      ? {
          title: "No organization to browse",
          detail:
            organizations.error?.problem?.detail ??
            "A Site Admin belongs to no organization, and the platform has none to look into.",
        }
      : null;

  // Not memoised: `useApi` hands back a fresh result object on every render, so a memo here
  // would recompute every time and buy nothing. The provider only re-renders when one of its
  // own requests settles, which is exactly when consumers need to.
  const value: Workspace = {
    me: me.data,
    meError: me.error,
    organizationId,
    organization: organization.data,
    organizationRefusal: organization.error?.isRefusal ? organization.error : null,
    organizationCount: organizations.data?.totalCount ?? null,
    blocked: me.error
      ? {
          title: me.error.problem?.title ?? "Not signed in",
          detail: me.error.problem?.detail ?? "The API did not recognise this session.",
        }
      : noOrganization,
    boards,
    statuses: [...(statuses.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    ideaTypes: [...(ideaTypes.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    state: me.error ? "error" : me.data && organizationId ? "ready" : "loading",
    stateOverride,
    setStateOverride,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const value = React.useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within a <WorkspaceProvider>");
  return value;
}
