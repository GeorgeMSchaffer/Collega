"use client";

/**
 * The role switcher's mechanism. The chrome is a screen slice's business, not this file's.
 *
 * There is no login in the shell, so the identity is chosen rather than proved. It is held
 * in two places on purpose: `localStorage`, which survives a reload and is read on mount,
 * and a cookie, which is what actually rides on the requests — including ones this module
 * never sees, like a server component's fetch or an image the browser loads. The cookie is
 * written from the stored value rather than the other way round, so `localStorage` stays the
 * single thing a person changes.
 *
 * It deliberately does not seed from `localStorage` during render: the server has no
 * storage, so reading it before mount is a hydration mismatch. The first paint is therefore
 * the default identity, and the stored one lands an instant later.
 *
 * A screen renders this with whatever control it likes:
 *
 *     const { identity, identities, setIdentity } = useMockIdentity();
 *
 * and everything below re-fetches, because `setIdentity` bumps a generation counter that a
 * data hook can key off. Switching role changes the answers to every request — that is the
 * whole point — so nothing cached from the previous identity may survive the switch.
 */

import * as React from "react";

import {
  DEFAULT_MOCK_IDENTITY,
  MOCK_IDENTITIES,
  MOCK_IDENTITY_COOKIE,
  MOCK_IDENTITY_STORAGE_KEY,
  type MockIdentity,
  isMockIdentity,
} from "./identity";

export interface MockIdentityValue {
  readonly identity: MockIdentity;
  readonly identities: readonly MockIdentity[];
  readonly setIdentity: (identity: MockIdentity) => void;
  /** Increments on every switch; use it as a fetch key so stale data cannot survive one. */
  readonly generation: number;
  /** False until the stored identity has been read, so a screen can hold off fetching. */
  readonly ready: boolean;
}

const MockIdentityContext = React.createContext<MockIdentityValue | null>(null);

function writeCookie(identity: MockIdentity): void {
  // Session cookie, site-wide path, Lax: it must ride on same-origin API calls and on
  // document navigations, and it must not outlive the browser session as a stale role.
  document.cookie = `${MOCK_IDENTITY_COOKIE}=${encodeURIComponent(identity)}; path=/; SameSite=Lax`;
}

function readStored(): MockIdentity | null {
  try {
    const stored = window.localStorage.getItem(MOCK_IDENTITY_STORAGE_KEY);
    return isMockIdentity(stored) ? stored : null;
  } catch {
    // Storage can throw outright in a private window or with site data blocked.
    return null;
  }
}

export function MockIdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = React.useState<MockIdentity>(DEFAULT_MOCK_IDENTITY);
  const [generation, setGeneration] = React.useState(0);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // localStorage does not exist during SSR, so the stored identity can only be read
    // after mount. That costs one extra render, which is the accepted price of not
    // rendering the wrong role first. useSyncExternalStore is the shape that would
    // satisfy the rule properly; worth doing once the screens settle.
    const stored = readStored() ?? DEFAULT_MOCK_IDENTITY;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentityState(stored);
    writeCookie(stored);
    setReady(true);
    if (stored !== DEFAULT_MOCK_IDENTITY) setGeneration((value) => value + 1);
  }, []);

  const setIdentity = React.useCallback((next: MockIdentity) => {
    try {
      window.localStorage.setItem(MOCK_IDENTITY_STORAGE_KEY, next);
    } catch {
      // Unwritable storage costs persistence across reloads, not the switch itself.
    }
    writeCookie(next);
    setIdentityState(next);
    setGeneration((value) => value + 1);
  }, []);

  const value = React.useMemo<MockIdentityValue>(
    () => ({ identity, identities: MOCK_IDENTITIES, setIdentity, generation, ready }),
    [identity, setIdentity, generation, ready],
  );

  return <MockIdentityContext.Provider value={value}>{children}</MockIdentityContext.Provider>;
}

export function useMockIdentity(): MockIdentityValue {
  const value = React.useContext(MockIdentityContext);
  if (!value) throw new Error("useMockIdentity must be used within a <MockIdentityProvider>");
  return value;
}
