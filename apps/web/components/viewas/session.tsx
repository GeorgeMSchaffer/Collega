"use client";

/**
 * The View As session, client side.
 *
 * `SPEC/20-feature-view-as.md` is emphatic that the session is **server-side** (rule 1) and
 * **server-authoritative** (rule 7): the client never decides that a session exists. So
 * everything below is driven by what `POST /auth/view-as` answered, and nothing is inferred
 * from what the picker was asked for.
 *
 * ## What the corpus can and cannot support, because it shapes the whole slice
 *
 * The recordings cover the three endpoints in full — candidates for all five identities,
 * start and end for all four roles. Two things they do not cover, and both are surfaced on
 * screen rather than papered over:
 *
 *  1. **No fixture anywhere carries a non-null `viewingAs`.** The capture ended its session
 *     before re-reading `GET /auth/me`, so the field the contract says the banner renders
 *     from is always null. `auth.viewas.start.json`'s own note — *"Both identities come back
 *     inline so the banner needs no follow-up GET /auth/me"* — is the design this takes: the
 *     banner is built from the start response and held here until the API can report the
 *     session itself. That is the one piece of state this file keeps.
 *
 *     It is held in **`localStorage`**, deliberately, because that is exactly as durable as
 *     the identity it describes: `useMockIdentity` keeps the acting identity in
 *     `localStorage` and a site-wide cookie, so it already rides on a second tab and
 *     survives a restart. A tab-scoped banner over a browser-scoped identity is the one
 *     genuinely dangerous state this feature can reach — impersonating with no banner and no
 *     exit — so the two are kept in the same place and cleared together.
 *
 *  2. **The mock matches on method, path and identity — never on the request body.** So
 *     every `POST /auth/view-as` replays the one recorded session regardless of which row
 *     was clicked. The requested candidate is recorded here beside the server's answer so
 *     the banner can say plainly when the two are not the same person.
 *
 * ## Making the rest of the app answer as the target (rule 4)
 *
 * A real session changes what `ICurrentUserContext` reports, and every screen follows
 * without knowing impersonation exists. The mock has no session, so the equivalent here is
 * the identity the requests carry: on start it is set to the impersonated user's role, which
 * is exactly how the corpus is keyed. Three of the eight recorded candidates are the very
 * users the corpus recorded those identities as, so for them the app below is answering
 * about the real person; for the rest it is answering as the recorded user of that role, and
 * the banner says so. Nothing is invented either way.
 */

import { usePathname } from "next/navigation";
import * as React from "react";

import { ApiError, apiJson, useMockIdentity, type MockIdentity } from "@/mocks";
import type { Me, Role } from "@/lib/types";
import { candidateName, type ViewAsCandidate, type ViewAsStart } from "@/components/viewas/types";

/** Rule 8/9: a convenience, never the authorization — the server refuses everyone else. */
export const MAY_VIEW_AS: readonly Role[] = ["SiteAdmin", "OrgAdmin"];

const STORAGE_KEY = "collega.viewas.session";

export interface ViewAsSession extends ViewAsStart {
  /** Who the picker asked for, kept so a substituted answer can be named as one. */
  readonly requestedUserId: string;
  readonly requestedName: string;
  /** The identity the real actor was signed in as, restored on exit. */
  readonly actorIdentity: MockIdentity;
  /** The identity every request carries while the session is live. */
  readonly actingIdentity: MockIdentity;
}

export interface ViewAs {
  /** Null unless the server said a session exists and the requests are carrying it. */
  readonly session: ViewAsSession | null;
  readonly starting: boolean;
  readonly ending: boolean;
  /** The API's own words when a start or an exit was refused. */
  readonly error: ApiError | null;
  readonly pickerOpen: boolean;
  /** `invoker` is handed focus back when the picker closes. */
  readonly openPicker: (invoker: HTMLElement | null) => void;
  readonly closePicker: () => void;
  readonly start: (candidate: ViewAsCandidate) => Promise<void>;
  readonly end: () => Promise<void>;
  /**
   * Set by `start`, cleared by whoever acts on it.
   *
   * Starting a session changes the identity, and `DeskShell` keys the work column on that —
   * so the picker and the control that opened it are both torn out of the DOM in the same
   * commit that closes the drawer. Handing focus back to the invoker is then a no-op against
   * a detached node, and a keyboard user lands on `<body>` with the banner's exit unreachable
   * without tabbing from the top. The banner claims this flag on mount and takes focus itself.
   */
  readonly pendingBannerFocusRef: React.RefObject<boolean>;
  /**
   * True once per visit to `key`, so a screen can open the picker on arrival without
   * re-opening it when the same screen re-renders for another reason — notably the remount
   * that exiting a session causes, which would otherwise reopen the drawer the exit just shut.
   */
  readonly claimAutoOpen: (key: string) => boolean;
}

const ViewAsContext = React.createContext<ViewAs | null>(null);

function readStored(): ViewAsSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ViewAsSession) : null;
  } catch {
    // Storage can throw outright in a private window or with site data blocked; a session
    // that cannot be restored is one the banner simply does not show.
    return null;
  }
}

function writeStored(session: ViewAsSession | null): void {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Unwritable storage costs the banner a reload, not the session itself.
  }
}

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const { identity, setIdentity, ready } = useMockIdentity();
  const [session, setSession] = React.useState<ViewAsSession | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [ending, setEnding] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const invokerRef = React.useRef<HTMLElement | null>(null);
  const pendingBannerFocusRef = React.useRef(false);
  const autoOpenedFor = React.useRef<string | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    // Leaving the screen that auto-opens the picker is what makes arriving at it count as a
    // new visit. Staying put — which is what exiting a session does — does not.
    if (pathname !== autoOpenedFor.current) autoOpenedFor.current = null;
  }, [pathname]);

  const claimAutoOpen = React.useCallback((key: string) => {
    if (autoOpenedFor.current === key) return false;
    autoOpenedFor.current = key;
    return true;
  }, []);

  React.useEffect(() => {
    // localStorage does not exist during SSR, so a held session can only be read after
    // mount — the same constraint, and the same one-extra-render cost, as the identity itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(readStored());
  }, []);

  const openPicker = React.useCallback((invoker: HTMLElement | null) => {
    invokerRef.current = invoker;
    setError(null);
    setPickerOpen(true);
  }, []);

  const closePicker = React.useCallback(() => setPickerOpen(false), []);

  const start = React.useCallback(
    async (candidate: ViewAsCandidate) => {
      setStarting(true);
      setError(null);
      try {
        const started = await apiJson<ViewAsStart>("/auth/view-as", {
          method: "POST",
          body: { targetUserId: candidate.userId },
        });
        const next: ViewAsSession = {
          ...started,
          requestedUserId: candidate.userId,
          requestedName: candidateName(candidate),
          actorIdentity: identity,
          actingIdentity: started.impersonating.role,
        };
        writeStored(next);
        // Batched with the identity switch below, so the session is never briefly live
        // under the actor's own identity.
        setSession(next);
        setIdentity(next.actingIdentity);
        setPickerOpen(false);
        pendingBannerFocusRef.current = true;
      } catch (cause) {
        setError(cause instanceof ApiError ? cause : new ApiError(0, null, null));
      } finally {
        setStarting(false);
      }
    },
    [identity, setIdentity],
  );

  const end = React.useCallback(async () => {
    if (!session) return;
    setEnding(true);
    setError(null);
    try {
      // Idempotent by contract: no active session also answers 204, so a client that has
      // lost track can always get back to a known-good position.
      await apiJson("/auth/view-as", { method: "DELETE" });
      writeStored(null);
      setSession(null);
      setIdentity(session.actorIdentity);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(0, null, null));
    } finally {
      setEnding(false);
    }
  }, [session, setIdentity]);

  // A session is only live while the requests are actually carrying the impersonated
  // identity. Choosing a different identity in the reviewer band is not an exit — it means
  // the caller the server would answer is somebody else entirely — so the banner goes
  // rather than standing over data it no longer describes.
  const live = ready && session && identity === session.actingIdentity ? session : null;

  React.useEffect(() => {
    if (ready && session && identity !== session.actingIdentity) {
      writeStored(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(null);
    }
  }, [ready, identity, session]);

  const value = React.useMemo<ViewAs>(
    () => ({
      session: live,
      starting,
      ending,
      error,
      pickerOpen,
      openPicker,
      closePicker,
      start,
      end,
      pendingBannerFocusRef,
      claimAutoOpen,
    }),
    [live, starting, ending, error, pickerOpen, openPicker, closePicker, start, end, claimAutoOpen],
  );

  return (
    <ViewAsContext.Provider value={value}>
      <ViewAsInvokerContext.Provider value={invokerRef}>{children}</ViewAsInvokerContext.Provider>
    </ViewAsContext.Provider>
  );
}

/** The control that opened the picker, so closing it can hand focus straight back. */
const ViewAsInvokerContext = React.createContext<React.RefObject<HTMLElement | null> | null>(null);

export function useViewAsInvoker(): React.RefObject<HTMLElement | null> {
  const ref = React.useContext(ViewAsInvokerContext);
  if (!ref) throw new Error("useViewAsInvoker must be used within a <ViewAsProvider>");
  return ref;
}

export function useViewAs(): ViewAs {
  const value = React.useContext(ViewAsContext);
  if (!value) throw new Error("useViewAs must be used within a <ViewAsProvider>");
  return value;
}

/** The name a screen shows for an identity, with the email as the last resort. */
export function personName(person: Me): string {
  return `${person.firstName} ${person.lastName}`.trim() || person.email;
}

/**
 * What to call the impersonated user.
 *
 * Once the session is live, `GET /auth/me` is that user's own record and is the name every
 * other surface — the rail avatar, a page's own copy — is showing. Preferring it keeps the
 * banner from disagreeing with the screen under it; the start response is what stands when
 * the two are not the same person, and the banner says so separately.
 */
export function impersonatedName(session: ViewAsSession, me: Me | null): string {
  return me?.userId === session.impersonating.userId ? personName(me) : personName(session.impersonating);
}
