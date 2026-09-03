# tools/

Developer tools. Not part of the deployed product and not part of the test suite.

## golden

The TypeScript conversion's capture and replay harness — Wave A of
`SPEC/50-typescript-migration.md`. It records what the live .NET API answers for
every endpoint and role, and replays that against whatever stands there later.
Own README: `tools/golden/README.md`.

**The capture has a deadline.** It has to run while the .NET API still exists;
once Sprint 8 retires the stack, the conversion has no oracle at all.

```bash
node tools/golden/src/cli.ts inventory     # the 81 endpoints, read from the controllers
node --test "tools/golden/test/*.test.ts"  # the harness's own tests
```

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
export ANTHROPIC_API_KEY='<key>'
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

# Re-read a saved sweep without spending anything
dotnet run -- report runs/baseline.json

# Capture every call as a runnable .http file plus its raw response
dotnet run -- run --cases cases/ --repeat 1 --max-spend 0.10 --trace trace/
```

### Seeing exactly what was sent — `--trace`

Writes two files per model call into the trace directory:

```
trace/calibration-checklist.attempt-1.turn-01.http
trace/calibration-checklist.attempt-1.turn-01.response.json
```

The `.http` file opens and runs in VS Code REST Client, JetBrains, or Visual Studio, and contains the
whole request: the system prompt with its `cache_control` breakpoint, the full organization catalog, the
message array, `output_config.effort`, and the per-request JSON schema with its closed option enums.
Edit the body and re-send to try something by hand.

**These are the real wire bytes**, captured from inside the SDK's handler pipeline rather than rebuilt
from the inputs. That distinction is the same one that made this a .NET project instead of a script: a
reconstruction would drift from what the product sends, and you would be debugging the reconstruction.
Verified by replaying a traced body with `curl` — it returned a valid response *and* hit the prompt
cache (`cache_read_input_tokens` non-zero), which only happens if the prefix matches byte for byte.

Two deliberate departures from the captured request:

- **The API key is never written.** `x-api-key` becomes `{{apiKey}}`, resolved from `ANTHROPIC_API_KEY` via
  `{{$processEnv}}`. A trace directory can be attached to a bug report without leaking a credential.
- **`Content-Length` is omitted.** It described the body as sent, so a stale value would truncate or
  reject the request the moment you edit anything. Every REST client computes it.

The JSON is pretty-printed and left unescaped, so it is semantically identical to the bytes sent but not
byte-identical — which matters only if you are counting bytes rather than reading or replaying.

Traces are gitignored. They carry no key, but they do carry a full organization catalog and
conversation, so share one on purpose rather than by accident.

**Compare like with like.** `--prompt` loads a file once and uses it verbatim, so the catalog in that
file is the catalog every case sees — the fixture no longer drives it. Comparing a `--prompt` run
against a compiled run therefore measures two changes at once. Dump a static baseline and compare
static against static.

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

**Caveat measured on the first real sweep:** `scope-coffee-unnarrowed` is itself unreliable. With no
scope statement the model refuses break-room coffee roughly half the time on its structural test alone
(3/3 on one run, 1/3 and 2/3 on others). Treat a single failure there as noise, not a regression, and
read the pair together rather than either half alone.

### What the guards can and cannot catch

The cache guard fires on **zero** cache reads across a sweep. Verify it with a doctored run file rather
than by trying to build a "volatile" prompt: `--prompt` reads the file once, so even a prompt containing
a timestamp is byte-identical on every call and caches normally. A static file cannot reproduce a
per-request prefix — only a code change to the builder can.

```bash
python3 -c "import json;d=json.load(open('runs/baseline.json'));[a.__setitem__('cacheReadTokens',0) for a in d['attempts']];json.dump(d,open('runs/doctored.json','w'))"
dotnet run -- report runs/doctored.json    # exits 1 with ZERO READS
```

`--max-spend` is checked twice: against the estimate before starting, and against real spend after every
call. In practice the up-front check does the work, because the estimate (~$0.004/call) is deliberately
higher than observed cost (~$0.0027/call). The mid-sweep check is the backstop for when that estimate is
wrong — a raised effort setting, much longer transcripts, or a pricier model.
