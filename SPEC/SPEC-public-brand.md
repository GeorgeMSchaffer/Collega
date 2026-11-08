# Spec: public-brand

Status: draft for owner review. No implementation authorized.
Authority: `worksprint-phase-1-capability-map.md`, owner decisions 2026-11-05.

## Objective

Rename the current public-facing application and current platform references
from Collega to WorkSprint without changing product behavior or technical
identities. Use 02C / Team Convergence on both the app and marketing site.
Phase 2 is unscheduled and starts only on a later owner request.

## Tech stack and commands

Existing Next.js 16.3.4, React 19.2.8, TypeScript 7.0.2,
Tailwind 4.3.3 and workspace design-system primitives.
Node >=24.20.0; pnpm >=12.3.4.

Run from the repository root:

```powershell
pnpm --filter @collega/web test
pnpm --filter @collega/web typecheck
pnpm --filter @collega/web build
pnpm check
pnpm dev
pnpm test:e2e
```

The e2e command requires a running isolated application/test setup. Choose
focused cases during implementation; don't run destructive setup on production.
Assistant changes require the existing prompt-evaluation procedure; do not
infer authorization for live model requests from spec approval.

## Project structure

- `apps\web\app`, `components`: public copy, titles, messages and logo placement.
- `packages\design-system`: shared approved mark asset and primitives if needed;
  exact asset placement is determined in the plan.
- `packages\application\src\ai`: source-default product-name references only.
- `packages\infrastructure\src\demo-seed`: future display defaults only.
- `SPEC\mockups`, current spec prose, README and demo/deck generators:
  current references, with a reviewed file manifest before editing.
- `apps\web\test`, `e2e`: QA-owned brand and continuity checks.

## Code style

Preserve existing formatting, single quotes and workspace boundaries. A
representative proposed name-only change, not new behavior:

```typescript
export const metadata = {
  title: 'WorkSprint',
}
```

Keep `@collega/*` imports and technical identifiers. Do not introduce a
brand-configuration abstraction merely for replacing display strings.
Mark geometry comes from symbol `c` in
`mockups\worksprint-parallel-tracks.html`. Review any geometric refinement;
the comparison board's font and colors are not an approved redesign.

## Testing strategy

QA adds/updates high-impact Vitest and Playwright assertions, not blanket
coverage. Verify wordmark and mark at normal app sizes, 16px/32px, desktop
and 375px, light and dark themes. Confirm name-only changes preserve
login, forced-password-change, logout, drawers and navigation.
Prompt-default changes must be assessed without modifying frozen baselines.
No network, real clock or randomness in unit tests.

## Boundaries

- Always: preserve the application palette/layout, technical names and seed
  UUIDs; record residual-name exceptions; run `pnpm check` before completion.
- Ask first: new dependencies, changed mark geometry, public claims, live
  evaluations, changed contracts, stored-content updates or release actions.
- Never: rewrite git history, frozen golden/prompt data, historical records,
  user content or custom organization prompts; reseed production for branding.

## Success criteria

1. Current application-owned visible copy, metadata and selected current
   references use WorkSprint; all residual Collega occurrences are classified
   as retained technical, historical, frozen or user-owned references.
2. The approved 02C mark replaces the platform CG badge consistently and
   has usable light/dark and small-size variants without changing tenant logos.
3. Current source-default assistant/welcome strings use the new name.
   Stored custom prompts/messages and member content are unchanged.
4. Current reference builders cannot regenerate the old public brand in
   the selected deliverables; the plan enumerates that set before editing.
5. QA, reviewer approval and the complete repository gate pass; no
   rename-caused behavior regression remains unresolved.

## Open gates

- Owner approves this spec before planning.
- Plan review selects the exact current collateral manifest.
- Final production mark rendering and prompt evaluation evidence require review.
- Domain release is governed by `SPEC-public-domain.md`.
