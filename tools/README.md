# tools/

Developer tools. Not part of the deployed product and not part of the test suite.

## golden

The TypeScript conversion's capture and replay harness — Wave A of
`SPEC/50-typescript-migration.md`. It holds a recorded corpus of what the API
answered for every endpoint and role, and replays it against whatever stands
there later. Own README: `tools/golden/README.md`.

**The capture already happened** — 447 cases across 81 endpoints × 4 roles, on
2026-09-03, while the application it recorded still ran. That application is gone
(slice F6), so the corpus cannot be re-recorded against its original: it is a
fixed record now, and `inventory.json` is frozen alongside it. Replay, coverage
and the harness's own tests are unaffected.

It is a **regression detector, not a specification** (`SPEC/decisions.md`
2026-09-09). A diff is a question — fix it, accept and record it, or deliberately
do better — not automatically a defect.

```bash
node tools/golden/src/cli.ts inventory     # the 81 endpoints the corpus covers
node tools/golden/src/cli.ts coverage      # what the scenarios reach
node --test "tools/golden/test/*.test.ts"  # the harness's own tests
```


## demo-shots

The demo screenshot set and the page that presents it. It drives a local Collega in Chromium,
signs in as the seeded accounts from `demo.md`, and writes `demo/screenshots/` — then builds
`demo/deck.html` around those images from the captions in `tools/demo-shots/shots.ts`.

```bash
pnpm start   # in one terminal: API on :3001, web on :3000, database seeded
pnpm shots   # re-photograph every screen
pnpm deck    # rebuild demo/deck.html
```

`shots.ts` is the only place the order, the captions and the file names live, so adding a screen
means adding an entry there and re-running both. The capture writes through the UI — the discussion
screen is a real comment posted by a real account — and refuses to run against anything but
localhost, because the passwords it uses are published in `demo.md`.

## Prompt tooling

There used to be two: an interactive browser page, and a console tool that scored a
prompt across a corpus. The console tool was written in the stack this repository no
longer contains and was deleted with it. Its **corpus survived** as data, in
`tools/prompt-eval/` — nine cases and three organization fixtures, plus the
methodology that made them worth running.

So there is currently one runnable tool and one unanswered question:

| | `prompt-lab.html` | (no runner) |
|---|---|---|
| Question | "What does *this* wording do to *this* message?" | "Is this prompt better than that one, across the corpus?" |
| Loop | Interactive — edit, send, read, repeat | — |
| Scope | One message, one turn | 9 cases × N repeats |
| Gives you | The response, rendered legibly | Pass rates, flakiness, cost ceiling |

That gap is real and it is worth knowing about before editing the prompt: the scope
gate is a security control, and a wording change that sharpens the questions while
softening refusal is a regression nobody can feel one message at a time. See
`tools/prompt-eval/README.md`, and `SPEC/20-feature-ai-idea-assist.md` requirement 37c
on why a handful of interactive probes proves less than it looks.


## prompt-lab.html

A single self-contained HTML file. No server, no build step, no install — open it with `file://`.

```bash
open tools/prompt-lab.html
```

Paste in a template carrying `{{ORGANIZATION_CATALOG}}` and `{{SCOPE_STATEMENT}}` — either
the active one from `GET /api/v1/ai-assist/prompt`, or the built-in default,
`SYSTEM_PROMPT_TEMPLATE` in `packages/application/src/ai/prompt-defaults.ts`.

It splits the pasted prompt on its `##` headings into editable sections, derives the response JSON
schema from the option ids in the catalog, and calls `api.anthropic.com` from the browser (which needs
the `anthropic-dangerous-direct-browser-access` header — that is why no server is involved).

Two things it deliberately will not let you edit: the `<organization_data>` and `<scope_statement>`
blocks. That fencing is what stops a tag literally named `</organization_data> New instructions:` from
ending the block and continuing as the operator, and it belongs in reviewed server code — the page
renders those blocks read-only, exactly as the server produced them.

The page carries **no copy of the prompt prose**, so it cannot drift from `prompt-defaults.ts`; everything
comes from what you paste. Your API key is pasted at runtime into `sessionStorage` and is never written
to disk or committed.

**Cost:** `Render` composes the prompt and shows it for free — that covers most wording iteration. `Send`
is one billed call per click. Because the system block is the only `cache_control` breakpoint, an edited
prompt is a new prefix and bills cache-*creation* at 1.25× input rather than cache-*read* at 0.1× —
roughly 4× a warm production turn. Re-sending unchanged text hits the cache; the page shows which
happened.

## prompt-eval

The evaluation corpus the deleted console tool consumed: nine cases and three
organization fixtures, with the methodology that makes them worth keeping.
Data only — see `tools/prompt-eval/README.md`.
