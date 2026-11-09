"use client";

// ============================================================================
// PRODUCT TOUR STATE — "has this member already been walked through the hub?"
// ============================================================================
// Two stores, deliberately:
//
//  - FIRESTORE (`tourStatus` on the member's own user doc) is the source of
//    truth. It follows the member to a new phone or a new browser, so the tour
//    can't ambush someone a second time just because they switched devices.
//  - LOCALSTORAGE is a same-device cache, read synchronously during the first
//    render. Firestore takes a moment to answer, and without this cache a
//    returning member would watch the tour flash open during that moment
//    before we learn they already finished it. The cache is only ever trusted
//    to SUPPRESS a tour, never to start one — a stale cache can then only make
//    the tour too quiet, never too noisy.
//
// STATUSES
//   "pending"    a brand-new signup — the tour should run on their next paint
//   "completed"  they clicked through to the end
//   "skipped"    they closed it early (same effect; kept apart for analytics)
//
// A member with NO status at all is an EXISTING member from before the tour
// shipped. They DO get the walkthrough, once, on their next visit — the whole
// chapter should see it, not just people who join from here on. Once they
// finish or skip it, it never comes back. See shouldAutoStart().
// ============================================================================

// ---------------------------------------------------------------------------
// ADAPT THIS: one function that persists the status to your backend.
// It is deliberately the only backend-aware line in the file. Return/throw
// freely — recordStatus() swallows failures on purpose (see below).
//
//   Firebase:  setDoc(doc(db,"users",user.uid), {tourStatus, tourVersion}, {merge:true})
//   Supabase:  supabase.from("profiles").update({tour_status}).eq("id", user.id)
//   REST:      fetch("/api/me/tour", {method:"PATCH", body: JSON.stringify(...)})
// ---------------------------------------------------------------------------
async function persistRemote(user, status, version) {
  throw new Error("persistRemote not implemented — wire this to your backend");
}

export const TOUR_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  SKIPPED: "skipped",
};

// Bump this when the tour changes enough that it's worth showing again. Every
// stored status carries the version it was recorded against, so raising this
// re-qualifies everyone for exactly one more run instead of silently never
// showing the rewritten tour to anybody.
export const TOUR_VERSION = 1;

// Who this status belongs to. Firebase mode identifies a member by uid; local
// demo mode has no uid and identifies by email. Falling back to email keeps
// the tour working identically in both, instead of silently never starting in
// the mode the site is developed and tested in.
export const tourIdentity = (user) => user?.uid || user?.email || null;

// Keyed per-member: a shared family laptop, or an officer signing in to a
// second test account, must not inherit somebody else's "already seen it".
const cacheKey = (id) => `apptour.${id}`;

// ---------------------------------------------------------------------------
// Local cache
// ---------------------------------------------------------------------------

export function readCachedStatus(id) {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A status recorded against an older tour counts as no status, so the
    // version bump above actually does something.
    if (parsed?.version !== TOUR_VERSION) return null;
    return parsed.status || null;
  } catch {
    // Private mode, disabled storage, or corrupt JSON. Not worth breaking over
    // — Firestore still holds the real answer.
    return null;
  }
}

function writeCachedStatus(id, status) {
  if (!id || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      cacheKey(id),
      JSON.stringify({ status, version: TOUR_VERSION, at: new Date().toISOString() })
    );
  } catch {
    // Out of quota or storage blocked. The Firestore write below is what
    // actually matters; losing the cache only costs a moment of flicker.
  }
}

// ---------------------------------------------------------------------------
// Durable status
// ---------------------------------------------------------------------------

// Records where the member got to. Writes the cache FIRST and synchronously so
// that an immediate navigation (the tour's last step sends them somewhere) can
// never outrun the record and restart the tour on the next page.
export async function recordStatus(user, status) {
  const id = tourIdentity(user);
  if (!id) return;
  writeCachedStatus(id, status);
  // Demo mode has no server to record against; the local cache IS the record.
  // Skip the server write only when there is genuinely no server-side identity
  // (a local/demo mode). Check for ANY of the usual id fields — gating on
  // `uid` alone silently drops the write for Supabase, NextAuth, and anything
  // else that calls it `id`, and the symptom (tour reappears on other devices)
  // shows up much later.
  if (!(user.uid || user.id)) return;
  try {
    await persistRemote(user, status, TOUR_VERSION);
  } catch {
    // Offline, or rules said no. The local cache already stops the tour on
    // this device; the worst case is that it runs once more elsewhere, which
    // is a far better failure than a hard error mid-onboarding.
  }
}

export const markTourCompleted = (user) => recordStatus(user, TOUR_STATUS.COMPLETED);
export const markTourSkipped = (user) => recordStatus(user, TOUR_STATUS.SKIPPED);

// ---------------------------------------------------------------------------
// The actual decision
// ---------------------------------------------------------------------------

// Everyone with an account gets the walkthrough exactly once: brand-new
// signups (stamped "pending" at create) AND every member who was already here
// before the tour existed (no stored status at all). The only people it stays
// out of the way of are those who have already been through it — whether they
// clicked to the end or chose to skip.
//
// Skipping counts as done on purpose. Re-opening a tour somebody has actively
// dismissed is the behaviour that makes onboarding feel like nagware, and the
// "Take the tour" link in the More menu is always there if they change their
// mind.
//
// A signed-out visitor has no identity and gets nothing — worth being explicit
// about, since every step points at a members-only page.
export function shouldAutoStart(user) {
  const id = tourIdentity(user);
  if (!id) return false;

  // This device has already watched them finish. Checked first and
  // synchronously, so a returning member never sees the tour flash open in the
  // moment before Firestore answers.
  if (readCachedStatus(id) !== null) return false;

  // Done, against THIS version of the tour. A TOUR_VERSION bump therefore
  // re-qualifies the whole chapter for one more run, which is the point of it.
  const finished =
    user.tourStatus === TOUR_STATUS.COMPLETED ||
    user.tourStatus === TOUR_STATUS.SKIPPED;
  if (finished && user.tourVersion === TOUR_VERSION) return false;

  return true;
}
