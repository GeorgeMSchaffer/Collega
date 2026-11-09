# Who sees the tour, and exactly once

## The two-store model

**Server flag (source of truth).** A field on the user record — `tourStatus`,
plus a `tourVersion`. It follows the user to another browser or phone, which is
what stops the tour ambushing them a second time on a different device.

**Local cache (suppression only).** The same status in `localStorage`, read
synchronously during first render. The server takes a moment to answer, and in
that moment a returning user would watch the tour flash open. The cache closes
that gap.

The asymmetry is the important part: **the cache may only suppress a tour,
never start one.** A stale or wrong cache can then make the tour too quiet,
never too noisy — and "too quiet" is a mild bug while "too noisy" is the one
that makes people hate the feature.

## Statuses

- `pending` — owes the tour
- `completed` — clicked through to the end
- `skipped` — quit early

Keep `skipped` distinct from `completed` for analytics, but treat them the same
when deciding whether to auto-start. **Skipping counts as done.** Re-opening a
tour someone actively dismissed is nagware.

## Identity — the subtle one

Key the cache on a stable per-user identity. If the app has more than one auth
mode — a real backend plus a local/demo mode for development, say — an ID that
exists in only one of them makes the tour *silently never run* in the other,
which is usually the mode you develop and test in.

```js
const tourIdentity = (user) => user?.uid || user?.email || null;
```

Key per-user, not globally: a shared family laptop, or someone signing into a
second test account, must not inherit another person's "already seen it".

## The decision

```js
export function shouldAutoStart(user) {
  const id = tourIdentity(user);
  if (!id) return false;                       // signed out: never

  if (readCachedStatus(id) !== null) return false;   // this device saw them finish

  const finished = user.tourStatus === "completed" || user.tourStatus === "skipped";
  if (finished && user.tourVersion === TOUR_VERSION) return false;

  return true;                                 // includes users with NO status
}
```

That final `return true` encodes **"everyone with an account, once"** — a user
with no stored status at all (i.e. everybody who existed before the tour
shipped) qualifies.

For the stricter **"new signups only"** policy, stamp `tourStatus: "pending"`
when the account is created and require it explicitly:

```js
  if (user.tourStatus !== "pending") return false;
```

Both are defensible. Which one is right is a product decision — ask, then
record the answer in a comment next to this function.

## Versioning

Store `tourVersion` alongside the status and treat a mismatch as "hasn't seen
it". Bumping the constant re-qualifies everyone for exactly one more run, which
is how a substantially rewritten tour gets seen by people who took the old one.

## Writing the flag

Write the cache **first and synchronously**, before any navigation the final
step performs — otherwise a redirect can outrun the record and the tour
restarts on the next page.

Let the server write fail quietly. Offline or a rejected permission shouldn't
throw an error in the middle of someone's onboarding; the local cache still
stops the tour on this device, and the worst case is that it runs once more
elsewhere.

Check the write is actually **permitted** by whatever authorization rules the
app has. A rules layer that freezes most user fields may still allow adding
new ones — verify rather than assume, because the failure is silent and the
symptom (tour repeats on other devices) shows up much later.

## The delay that silently disables the tour

A short delay before opening is worth having — landing on a page and having it
dim mid-paint reads as a glitch. But a naive implementation kills the feature:

```jsx
// BROKEN — looks fine, never runs
useEffect(() => {
  if (startedRef.current) return;
  if (!shouldAutoStart(user)) return;
  startedRef.current = true;                       // set BEFORE the wait
  const t = setTimeout(() => start(), 600);
  return () => clearTimeout(t);                    // any dep change cancels it
}, [ready, user, start]);
```

`user` typically gets a new object identity whenever the profile refreshes. If
that lands inside the 600ms window, the cleanup clears the timer while the
guard already says "started" — so the tour never opens, for anybody, with
nothing in the console.

Hold the timer in a ref and clear it only on unmount:

```jsx
const timer = useRef(null);
// ... inside the effect:
timer.current = setTimeout(() => start(), 600);   // no cleanup here
// ... separately:
useEffect(() => () => clearTimeout(timer.current), []);
```

This class of bug is worth watching for generally: a guard set before an async
gap, paired with a cleanup that can fire during it.

## An escape hatch

Always provide a permanent way to replay it — a "Take the tour" item in a menu.
It's what lets the auto-start rule stay strict, and it's how anyone who skipped
it gets a second chance without you loosening the policy.

A DOM event is a clean way to wire this without threading a context through the
component tree:

```js
window.dispatchEvent(new CustomEvent("app:tour:start"));
```
