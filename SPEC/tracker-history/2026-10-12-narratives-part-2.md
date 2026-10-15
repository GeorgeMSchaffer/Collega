# Tracker history — narratives moved 2026-10-12

Continues [2026-09-28-narratives.md](2026-09-28-narratives.md), verbatim.

## Narratives

### Agreed order of work (2026-09-12, decided with the user)
Settled in one sitting, so a later reader meets the whole set rather than one row of it. Items are
sequenced, not merely listed.

1. **`apps/web/lib/data/delivery.ts` onto the API.** The last data module still entirely on
   `../mock`; every other reader in `lib/data/` is at least partly converted. The five delivery
   screens already exist from Wave E and the eighteen endpoints are live and seeded, so this is the
   seam working as designed — replace reader bodies, not signatures.
   - **Open question handed over with it: Outcomes have no backend at all** (a table and a contract since
     slice 175, but no entity, service or endpoint; fixture and spec only, and the roadmap screen is built on them). Leave the three
     outcome readers on the fixture, or amend the schema again under ticket `06` — decide, do not
     invent.
2. **QA pass over `packages/application`,** in its own worktree, by an agent that did not write the
   code. 13,006 lines, six test files, and it carries authorization. Scheduled 2026-09-08 and never
   started; it is the only layer of consequence with no such pass. The D1 round is the pattern —
   26 → 87 tests, two divergences found that implementer and reviewer both missed.
3. **D6 and D7 together as one slice** — AI assist and View As, the last fifteen of the eighty-one.
   Taken together rather than View-As-first so Wave D closes in one pass.
4. **F6 deletes the .NET stack, after D6/D7** — not before. **Done 2026-09-13.** Gate: 23/23, `0 cached`.
   - 481 files: `src/Collega.*`, `tests/`, `Collega.sln`, `global.json`, `.config/dotnet-tools.json`,
     `DOTNET.md`, `tools/Collega.AiPlayground`, `deploy/azure`, `docker/proxy-ca`,
     `.claude/launch.json`, and the compose `api` and `web` services.
   - `README.md` was rewritten around installation, running locally, seeding and deployment — the
     deployment section did not exist before.
   - `SPEC/decisions.md` 2026-09-13 records the sweep rule (remove stale pointers, keep inherited
     rationale) and the two things that needed work rather than deletion: **`tools/golden` parsed
     the controllers**, which would have broken `replay` and `coverage`, not just `inventory` — the
     endpoint list is now a committed snapshot verified against the fixture manifest; and **the
     AI-assist evaluation corpus moved to `tools/prompt-eval`** because its .NET runner did not
     survive, which is a **capability lost, not relocated** (see "Known open risks").

5. **Rescope and spec the AI integration — after this batch, decided 2026-09-13.** Sequencing, not
   cancellation. **No further AI feature work starts on the current spec.** The full entry,
   including what it does not mean, is `SPEC/decisions.md` 2026-09-13. Why:
   - `SPEC/20-feature-ai-idea-assist.md` is live behind eleven endpoints and does one job: draft one
     new idea, in a chat, from a standing start.
   - Ingestion and refinement have no spec, similar-idea retrieval and org documents are deferred to
     v2 on `pgvector` the schema does not have.
   - The admin surface is the last fixture-backed screen in the product, and prompt changes became
     unmeasurable when F6 deleted the evaluation runner.

Deferred with reasons recorded in `SPEC/decisions.md` 2026-09-12: the rate limiter's collision with
the golden replay. Amended there the same day: the account lockout, which no longer needs the shared
store to stop being a denial-of-service.
