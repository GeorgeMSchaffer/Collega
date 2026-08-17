# tools/

Developer tools. Not part of the deployed product and not part of the test suite.

## Collega.AiPlayground

A prompt playground and eval harness for AI idea assist (`SPEC/20-feature-ai-idea-assist.md`).

**It makes real, billed calls to Anthropic.** That is why it lives here and not under `tests/`:
`tests/CLAUDE.md` forbids any test reaching a model provider, and `CollegaApiFactory` actively blocks it.
`dotnet test` never executes this project. Keep it that way — do not add a test project that references it.

### Why it exists

The system prompt is hardcoded in `IdeaAssistPromptBuilder.BuildSystemPrompt`. Without this tool, changing
it means editing C#, rebuilding, and clicking through the chat to form an impression — with no record of
whether the change helped, and no way to see what it broke. Three things make impressions unreliable here:

- **The scope gate is a security control.** `inScope` is what refuses prompt injection (rules 7–10, 25).
  A prompt edit that sharpens the questions while softening refusal is a regression you cannot feel.
- **The prompt is the cached stable prefix.** Anything per-request that leaks into it roughly doubles
  cost per turn while producing identical-looking output. The harness fails the run when cache reads
  hit zero, which is the only reliable way to catch it.
- **Output is nondeterministic.** `--repeat` reports a rate, so a case that passes two times in three is
  visibly flaky instead of looking fine on the run you happened to try.

### Setup

```bash
export Ai__ApiKey='<key>'      # or ANTHROPIC_API_KEY
```

No database and no running app: fixtures are synthetic JSON, so runs are reproducible and cannot be
pointed at a real organization's data by accident.

### Use

```bash
cd tools/Collega.AiPlayground

# 1. Render the real compiled prompt — your starting point
dotnet run -- dump-prompt --fixture acme > prompts/baseline.md

# 2. Edit a copy
cp prompts/baseline.md prompts/variant-a.md

# 3. Measure both over the same corpus
dotnet run -- run --cases cases/ --repeat 3 --max-spend 1.00 --json runs/baseline.json
dotnet run -- run --cases cases/ --prompt prompts/variant-a.md --repeat 3 --max-spend 1.00 --json runs/variant-a.json

# 4. The actual question
dotnet run -- compare runs/baseline.json runs/variant-a.json
```

A winning variant is **hand-ported back into `IdeaAssistPromptBuilder.cs`** as a normal reviewed change.
The prompt deliberately stays in code: it carries the injection fence and the cache-prefix guarantee, and
both belong under code review rather than in a text file.

`--max-spend` is a hard ceiling enforced mid-sweep, not a warning printed afterwards. Runs also refuse to
start when the estimate already exceeds it. Exit code is non-zero if any case failed or the cache guard
tripped.

### Fixtures

| Fixture | Purpose |
|---|---|
| `acme` | The demo catalog, no scope statement — matches the seeded state |
| `acme-scoped` | Same, with a scope statement set. Rules 7–9 are unmeasurable without it |
| `hostile-catalog` | Every value is an injection attempt. Use with `dump-prompt` to confirm the fence |

Option ids are derived from names, so they are stable across runs and machines and nobody hand-writes a
GUID. Cases therefore name options in prose (`"ideaType": "Continuous Improvement"`) rather than by id.

### Cases

One JSON file per case in `cases/`. `turns` is a scripted sequence of user messages; the runner appends
the model's `nextQuestion` between them, exactly as the client does, and scores the final response.
Refused turns are dropped from the transcript mid-case, matching rule 8 — otherwise a later turn would
carry context production would never have sent.

Only declared expectations are scored, so a refusal case asserts `inScope: false` and nothing else.

Note the deliberate pair: `scope-coffee-narrowed` expects **false** and `scope-coffee-unnarrowed` expects
**true** for the *same sentence*. That pair is the only thing proving the scope statement does anything.
If both start returning the same answer, the statement is being ignored — and every other case would
still be green.
