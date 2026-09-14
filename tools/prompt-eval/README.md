# prompt-eval

The corpus the AI idea-assist prompt was evaluated against
(`SPEC/20-feature-ai-idea-assist.md`): nine cases and three organization fixtures.

**There is no runner here.** The batch scorer that consumed these — pass rates over
N repeats, `compare` between two prompt templates, a spend ceiling, wire traces — was a
console application in the stack this repository no longer contains, and it was deleted
with it (conversion slice F6). The data outlived the tool because it is the expensive
half: each case pins a behaviour the prompt has to keep, and the reasoning below is what
took the measuring to arrive at.

Until a replacement exists, the only way to exercise a prompt change is
`tools/prompt-lab.html`, one message at a time. That answers "what does this wording do to
this message?" and cannot answer "is this prompt better than that one, across the corpus?"

---

## Why a corpus, rather than trying a few messages

Three things make impressions unreliable here, and all three still apply:

- **The scope gate is a security control.** `inScope` is what refuses prompt injection
  (rules 7–10, 25). A prompt edit that sharpens the questions while softening refusal is a
  regression you cannot feel by reading one good answer.
- **The prompt is the cached stable prefix.** Anything per-request that leaks into it
  roughly doubles cost per turn while producing identical-looking output. The only reliable
  detector was a run-wide check that cache reads never hit zero.
- **Output is nondeterministic.** Repeats report a *rate*, so a case that passes two times
  in three is visibly flaky instead of looking fine on the run you happened to try.

`SPEC/20-feature-ai-idea-assist.md` requirement 37c measured how little the interactive
probes prove on their own: removing the scope sentence from the default template and
probing returned 3 of 3 refused — identical to the unmodified default. Treat a green probe
run as "nothing is grossly broken", never as "this edit is safe."

## Fixtures

| Fixture | Purpose |
|---|---|
| `acme` | The demo catalog, no scope statement — matches the seeded state |
| `acme-scoped` | Same, with a scope statement set. Rules 7–9 are unmeasurable without it |
| `hostile-catalog` | Every value is an injection attempt. Deliberately adversarial: option names written to look like closing tags, which is what keeps the fencing around `<organization_data>` honest |

Option ids are derived from names, so they are stable across runs and machines and nobody
hand-writes a GUID. Cases therefore name options in prose
(`"ideaType": "Continuous Improvement"`) rather than by id.

## Cases

One JSON file per case. `turns` is a scripted sequence of user messages; a runner appends
the model's `nextQuestion` between them, exactly as the client does, and scores the final
response. Refused turns are dropped from the transcript mid-case, matching rule 8 —
otherwise a later turn would carry context production would never have sent.

Only declared expectations are scored, so a refusal case asserts `inScope: false` and
nothing else.

`happy-*` are the normal paths, `scope-*` the in-scope / out-of-scope boundary, `refuse-*`
the prompt-injection and off-topic refusals.

**The deliberate pair.** `scope-coffee-narrowed` expects **false** and
`scope-coffee-unnarrowed` expects **true** for the *same sentence*. That pair is the only
thing proving the scope statement does anything at all. If both start returning the same
answer, the statement is being ignored — and every other case would still be green.

**Caveat measured on the first real sweep:** `scope-coffee-unnarrowed` is itself unreliable.
With no scope statement the model refuses break-room coffee roughly half the time on its
structural test alone (3/3 on one run, 1/3 and 2/3 on others). Treat a single failure there
as noise, not a regression, and read the pair together rather than either half alone.

## Where the prompt lives

`SYSTEM_PROMPT_TEMPLATE` in `packages/application/src/ai/prompt-defaults.ts` is the
known-good baseline; every stored version is a divergence from it, and resetting falls back
there. It stays in code deliberately — it carries the injection fence and the cache-prefix
guarantee, and both belong under code review rather than in a text file.

A winning variant is hand-ported back into that file as a normal reviewed change, then
published through `PUT /api/v1/ai-assist/prompt`.

## If you build a replacement runner

Two findings worth not rediscovering:

- **Compare like with like.** Loading a prompt from a file uses it verbatim, so the catalog
  in that file is the catalog every case sees — the fixture no longer drives it. Comparing a
  file-loaded run against a compiled run measures two changes at once. Dump a static baseline
  and compare static against static.
- **A cache guard cannot be tested with a "volatile" prompt.** A file is read once, so even a
  prompt containing a timestamp is byte-identical on every call and caches normally. Only a
  code change to the builder can produce a per-request prefix; verify the guard by doctoring
  a saved run file instead.
