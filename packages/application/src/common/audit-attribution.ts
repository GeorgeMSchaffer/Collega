import type { CurrentUserContext } from './current-user-context.js'

// EXPORTED on purpose: an un-exported `unique symbol` in a type that crosses a package
// boundary breaks `declaration: true` emit (TS4023), which this workspace uses.
export declare const brand: unique symbol

/**
 * The (actor, on-behalf-of) pair that is persisted on an audit row.
 *
 * Branded so that constructing one requires going through `attributeAudit`. This is the
 * only place in the design where the type system rather than lint does the work, and it
 * earns that because the dual-attribution failure is silent and permanent - a wrong audit
 * row is not detectable after the fact.
 *
 * Honestly: a speed bump, not a barrier. `{...} as Attribution` compiles, exactly as
 * `brandAttribution` below relies on. What it buys is that skipping attribution takes a
 * deliberate cast, which a reviewer sees in the diff.
 */
export type Attribution = {
  readonly actorUserId: string | null
  readonly onBehalfOfUserId: string | null
  readonly [brand]: 'attributed'
}

/** The only producer. Not exported from the package - `attributeAudit` is the public door. */
const brandAttribution = (
  actorUserId: string | null,
  onBehalfOfUserId: string | null,
): Attribution => ({ actorUserId, onBehalfOfUserId }) as Attribution

/**
 * Maps the actor a service INTENDS to record onto the pair that is persisted, so
 * SPEC/20-feature-view-as.md rule 14 holds at every audit site rather than only inside the
 * View As service.
 *
 * While a session is live, `currentUser.userId` is the IMPERSONATED user - that is what
 * makes authorization apply to them (rule 4). Recording it as the audit actor would say the
 * target did this to themselves, which is exactly the accountability failure rule 14
 * prevents.
 *
 * The rewrite is deliberately conditional on `intendedActorUserId` matching the acting
 * identity. Some audit events name someone other than the caller, or no one - login-failure
 * events record the account being attempted and run before any authenticated context
 * exists. Those pass through untouched.
 *
 * NOT for entity authorship. `createdByUserId` / `updatedByUserId` record the TARGET, i.e.
 * plain `currentUser.userId`, because content created through View As genuinely belongs to
 * that organization (rule 15). Rules 14 and 15 point in opposite directions on purpose, and
 * any helper that "fixes" authorship to the real administrator is a bug.
 */
export function attributeAudit(
  currentUser: CurrentUserContext,
  intendedActorUserId: string | null,
): Attribution {
  if (
    currentUser.isImpersonating &&
    intendedActorUserId !== null &&
    intendedActorUserId === currentUser.userId
  ) {
    return brandAttribution(currentUser.realUserId, currentUser.userId)
  }
  return brandAttribution(intendedActorUserId, null)
}
