# Sprint 7.5: Operational Logging (Serilog, file sink, correlation IDs)

**Status:** Not started — **blocked on `SPEC/Bug Triage.md`** (see Entry gate below).
**Sequence:** 7.5 of 8 — see `SPEC/95-next-sprints.md`. Runs after Sprint 7 (`sprint-07-ai-idea-assist.md`, built and reviewed 2026-08-16) and **before Sprint 8** (`sprint-08-azure-deployment.md`). Numbered 7.5 rather than renumbering 8, following the Sprint 6.5 precedent, so existing cross-references to `sprint-08-*` stay valid.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal

Give the deployment a usable operational log. Today Collega has a mature **audit** trail (`audit_events`, ~40 event types) but essentially no **operational** logging: a codebase sweep on 2026-08-17 found exactly one real `ILogger` consumer in the whole solution (`src/Collega.Infrastructure/Seeding/StartupSeeder.cs`), no structured logging, no correlation ID, and — most consequentially — `src/Collega.API/ErrorHandling/AppExceptionHandler.cs` **logs nothing at all**, so a 500 leaves no trace anywhere except the client's error envelope.

The outcome: a developer opens a rolling file locally, finds a request by correlation ID, and sees the request summary, the identity behind it (including View As attribution), the SQL it ran, and the exception it threw — with tests proving no password, token, prompt, API key, or CSV content ever reaches that file.

**Why before Sprint 8.** The first Azure deploy is exactly when logs stop being optional: `az webapp log tail` is the only window into a running App Service, and `SPEC/50-azure-deployment.md` already makes it the verification step. Shipping the deploy first means debugging it blind.

This is **infrastructure, not product behavior** — no user-facing surface, no new endpoint. The one externally-visible change is the `X-Correlation-ID` request/response header (slice 2), which is a contract addition.

## Entry gate — this sprint does not start yet

`SPEC/Bug Triage.md` has ~10 open `TODO` items from the 2026-08-16 browser review (Enter-does-not-submit, the `DrawerShell` focus-trap family, Fluent field accessible names, and seven more). Per `CLAUDE.md` and the tracker's Pre-Feature Triage Gate those take priority, and the user **declined an exception on 2026-08-17** when asked directly.

So: clear the triage queue first — most likely as a paydown sprint in the 6.5 mould, since several of those items are one systemic `DrawerShell`/Fluent fix rather than ten independent ones — then start slice 1 here.

## Decisions — locked 2026-08-17 by user interview

| ID | Decision | Locked value |
|---|---|---|
| D-LIB | Logging library | **Serilog** (`Serilog.AspNetCore`). Rejected: hand-rolling an `ILoggerProvider` (~300 lines of rolling/retention/flush the project would own forever) and `Microsoft.Extensions.Logging.AzureAppServices` (plain-text only, App-Service-shaped semantics) |
| D-SCOPE | What is captured | **All four categories** — unhandled + `AppException` logging, HTTP request summary + correlation ID, EF Core SQL at Debug, auth + AI provider events |
| D-ENV | Where the file sink runs | **Development only.** Production stays console-only — every deployment target reads stdout (`az webapp log tail`, `kubectl logs`), and `SPEC/50-kubernetes-deployment.md` runs 2 API replicas with no volume for API pods, so a prod file log would be per-pod and lost on reschedule |
| D-CLIENT | Blazor WASM client | **Out of scope.** WASM cannot write files; shipping client logs would need a new ingest endpoint — a separate feature, not this sprint |

**Package approval (user, 2026-08-17):** `Serilog.AspNetCore`, pinned **8.0.3**, approved for `src/Collega.API`. This is the only new dependency the sprint may add without a fresh ask. It bundles the Console/File/Debug sinks plus `Serilog.Settings.Configuration`, so it is one `PackageReference`, not four. **Verify at restore** (`dotnet list package --include-transitive | grep -i serilog`) and record the transitive `Serilog` core version; fall back to 8.0.1 on an `NU1605` downgrade. Do not take 9.x — it moves the primary TFM past net8.0, unlike every other pin in the repo.

## Capacity

| Role | Slices | Notes |
|---|---|---|
| Backend Developer | 4 | Slices 1–2 (bootstrap, correlation ID + request summary), 4–5 (exception logging, identity enrichment), 6–7 (EF Debug + guard, auth/AI events). Slice 3's production code ships with it |
| QA Developer | 1 | Slice 3's test off-switch and slice 8's redaction suite — the sprint's real deliverable, since `SPEC/40-test-strategy.md` makes "no secrets in logs" a testable requirement that currently passes only *vacuously* |
| UI/UX Developer | 0 | **Sits this sprint out** — no client-facing scope |
| Code Reviewer | 1 (mandatory) | Touches the auth path, a third-party credential, and the request pipeline. No fast-track |

## Slices

Ship strictly in order; each is independently buildable and testable.

### Slice 1 — Serilog bootstrap, console only, all environments

Add the package. Wrap `src/Collega.API/Program.cs`'s top-level statements in `try / catch (Exception ex) when (ex is not HostAbortedException) / finally { await Log.CloseAndFlushAsync(); }`. The `when` filter is **required**: `dotnet ef migrations` aborts the host deliberately, and a bare catch turns every migration command into a Fatal and a non-zero exit.

**Two-stage init.** A `CreateBootstrapLogger()` console logger on line 1, so the existing `StartupConfigurationValidator` early-return — which runs before the real logger exists — can emit a `Log.Fatal` alongside its stderr banner. Then `builder.Host.UseSerilog((ctx, services, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).ReadFrom.Services(services).Enrich.FromLogContext())`.

**Delete the `Logging:LogLevel` sections from both appsettings files** and replace with a `Serilog:` section (`MinimumLevel` + per-source `Override`, one `WriteTo: Console`, `Properties.Application`). Serilog replaces the MEL providers, so leaving `Logging:LogLevel` in place leaves a silently-ignored second knob.

**`WriteTo` lives in `appsettings.json` only, never in the Development file** — Serilog merges config arrays *by index* across layers, so a second array mutates the console entry instead of appending. Development overrides `MinimumLevel` only.

**Deliberately unchanged:** `src/Collega.API/Startup/StartupConfigurationValidator.cs` gains no entry. Every logging key is optional-with-defaults, exactly like `Ai:ApiKey`, and `StartupConfigurationValidatorTests` hard-asserts the three required keys *and their order*. A missing log setting must never stop a boot.

*Tests: none new. The full suite is this slice's gate — it proves the `Program.cs` rewrite did not break the host, seeding, or `WebApplicationFactory`.*

### Slice 2 — Correlation ID + HTTP request summary

New: `src/Collega.API/Logging/CorrelationId.cs`, `CorrelationIdMiddleware.cs`, `RequestLogging.cs`.

Header `X-Correlation-ID`, in and out. Value = a **well-formed** inbound header (`[A-Za-z0-9._-]{1,64}`), else `httpContext.TraceIdentifier`. Never fabricate a GUID — `tests/CLAUDE.md` forbids randomness and `TraceIdentifier` is already unique. Validation is load-bearing, not cosmetic: the value is echoed into a response header *and* rendered client-side via `traceId`, so an unvalidated client string is CRLF header injection plus log forging. Malformed input is silently ignored, never a 400.

The middleware assigns `context.TraceIdentifier = correlationId`, sets the response header, and wraps the pipeline in `LogContext.PushProperty("CorrelationId", …)`. **Assigning `TraceIdentifier` is the key move**: `AppExceptionHandler.cs:85` and `ProblemDetailsServiceCollectionExtensions.cs:28` already publish it as the `traceId` extension, so *neither file needs changing* for logs and error envelopes to join on one string.

Middleware rather than a Serilog enricher, because an enricher cannot set a response header or reconcile `TraceIdentifier` — one component must own all three.

Pipeline order: `CorrelationIdMiddleware` first, then `UseSerilogRequestLogging` **above** `UseExceptionHandler` so the summary reports the final status the client saw. `GetLevel`: `Error` on exception or 5xx; **`Verbose` for `/api/v1/health`** (App Service and the k8s liveness probe would otherwise dominate a 2-replica stdout stream); else `Information`. Add `.WithExposedHeaders(...)` to the existing CORS policy so the separate-origin client can read the header.

**Query strings are never logged.** Serilog's `{RequestPath}` excludes the query by construction; the enricher must not add it.

**Spec-first:** this slice adds a request/response header, so `SPEC/30-Contracts.md` gets the `X-Correlation-ID` contract **before** the code lands.

*Tests — `tests/Collega.API.Tests/Logging/CorrelationIdTests.cs`: header on every response; well-formed inbound echoed verbatim; malformed (`"abc\r\nInjected: 1"`, 200 chars, `"a b"`) not echoed and the request still succeeds; on a 404 the problem-details `traceId` equals the response header.*

### Slice 3 — File sink (Development only) + the hermetic off-switch

New: `src/Collega.API/Logging/FileLoggingServiceCollectionExtensions.cs` (`FileLogOptions`, `ShouldWriteFile`, `AddCollegaFileLogging`).

A `FileLogging` config section read with the repo's established raw-`IConfiguration` + in-code-defaults pattern (structurally identical to `AiUsageLimits` in `InfrastructureServiceCollectionExtensions.cs:72-103` — the repo has **no `IOptions<T>` anywhere**). Defaults: `logs/collega-api-.log`, roll daily, retain 7, 50 MB, roll on size. `shared: true`, because `dotnet watch` restarts overlap and exclusive-open contention would fail startup for a purely diagnostic feature. Human-readable template, not `CompactJsonFormatter` — the file exists for a human in a terminal.

*Judgment call:* Serilog's own `Serilog:*` section uses `ReadFrom.Configuration`, the library's own idiom; hand-rolling it means re-implementing sink activation. The no-`IOptions` convention governs how *Collega's* settings bind, and is honoured exactly for the one section Collega owns.

**The sink is a DI registration (`AddSingleton<ILogEventSink>`, picked up by `ReadFrom.Services`), not a `Serilog:WriteTo` JSON entry.** This is deliberate and load-bearing: a DI registration is the only form the test harness can *remove*, matching the existing `IIdeaDraftModel` and `DbContextOptions` swaps in `CollegaApiFactory`. A developer who later adds `WriteTo: File` in JSON bypasses every guard below — say so in `src/Collega.API/CLAUDE.md`.

**`CollegaApiFactory` changes — belt-and-braces, the repo's own idiom:**
- *Constructor (belt):* `FileLogging__Enabled=false` plus an EF-command level override, as **real process environment variables**. Not `ConfigureAppConfiguration` — the same constraint that file's existing reviewer note explains for `SiteAdmin__Email`.
- *`ConfigureServices` (braces):* `RemoveAll<ILogEventSink>()`, then register an `InMemoryLogSink` (bounded ring buffer, lock-guarded) exposed as a `CapturedLogs` property. **Capturing, not throwing** — Serilog swallows sink exceptions, so a throwing sink fails silently, the opposite of the guarantee. The capture is what slice 8 asserts over. `AiConfiguredApiFactory` inherits it free.

`.gitignore`: `[Ll]ogs/` already covers the directory; add `*.log` for a stray custom path.

*Tests — `FileLoggingGuardTests.cs`: hermetic table over `ShouldWriteFile` (Dev+unset→true, Dev+`"false"`/`"FALSE"`→false, Production/Staging→false); `FileLogOptions.Read` defaults and overrides; one integration guard asserting no `logs/` directory and no `*.log` after driving a request — a deliberate, commented filesystem* read *that proves the no-filesystem rule holds.*

### Slice 4 — Exception logging

`src/Collega.API/ErrorHandling/AppExceptionHandler.cs` gains `ILogger<AppExceptionHandler>` (resolved from DI via `AddExceptionHandler<T>`; no other call sites). One call site, one structured template, levels matching the switch arms already in that file:

| Exception | Status | Level | Stack trace? |
|---|---|---|---|
| `ValidationAppException` | 400 | `Debug` | no |
| `UnauthorizedAppException` | 401 | `Information` | no |
| `ForbiddenAppException` | 403 | `Information` | no |
| `NotFoundAppException` | 404 | `Information` | no |
| `ConflictAppException` | 409 | `Information` | no |
| `LockedOutAppException` | 429 | `Warning` | no |
| `RateLimitedAppException` | 429 | `Warning` | no |
| `AiAssistUnavailableException` | 503 | `Warning` | no |
| unmapped (`return false`) | 500 | **not logged here** | — |

401/403/404/409 are expected traffic, not errors — at `Error` they would drown the real signal. Unmapped exceptions are left to `ExceptionHandlerMiddleware`, which already logs them at Error with a stack trace; double-logging a 500 with two stack traces is worse than one, and the request-summary line (promoted to Error by `GetLevel`) is the correlating record.

**Log `problemDetails.Detail` — server-authored prose — never `ValidationProblemDetails.Errors`**, whose field-level text can echo submitted values.

*Tests — `AppExceptionHandlerLoggingTests.cs`: hermetic recording logger + `DefaultHttpContext`; a `[Theory]` case per row; unmapped returns `false` and logs nothing; a `ValidationAppException` carrying `"P@ssw0rd-in-a-field"` produces no line containing it.*

### Slice 5 — Identity enrichment through `ICurrentUserContext`

New: `src/Collega.API/Logging/UserContextLogEnrichmentMiddleware.cs`; fill in `RequestLogging.Enrich`.

Registered **immediately after `app.UseAuthentication()`**, taking `ICurrentUserContext` as an `InvokeAsync` parameter. Resolving it in a middleware *constructor* is a captive-dependency bug; resolving it before `UseAuthentication` yields nulls that look like "enrichment is broken" rather than "it's in the wrong place".

Pushes `UserId`, `OrganizationId`, `Role`, and `RealUserId` **only while impersonating** — the same absence-is-unambiguous convention the claim emission uses, so a log line can never read as though the acted-as user did it themselves (`SPEC/20-feature-view-as.md` rule 14).

**Nothing here reads claims.** That is the whole reason this is an API-layer middleware over `ICurrentUserContext` rather than a Serilog enricher reading `HttpContext.User`: the tracker's Sprint 6 rule makes `ICurrentUserContext` the single identity chokepoint, and a claims-reading enricher would silently opt logging out of View As.

**Never enriched:** email, name, bearer token, query string, body, raw claims. Ids and role only.

*Tests — `RequestLogEnrichmentTests.cs`: anonymous → `CorrelationId` only; authenticated → ids + role, no `RealUserId`; impersonating → `RealUserId` present and distinct; no key or value in any case contains an email address.*

### Slice 6 — EF Core SQL at Debug, with the parameter guard

`appsettings.Development.json` gains `"Microsoft.EntityFrameworkCore.Database.Command": "Debug"` under `Serilog:MinimumLevel:Override`. Keep the blanket `Microsoft.EntityFrameworkCore: "Warning"` — a more specific source key wins, and an override may be lower than the default. Leave `Database.Connection` at Warning.

**The guard.** `AddInfrastructure` calls `options.UseNpgsql(connectionString)` and nothing else, so `EnableSensitiveDataLogging()` is off and EF renders every parameter as `?`. A `SaveChanges` writing a PBKDF2 hash, a reset token, or a CSV-imported initial password logs the SQL shape and no values. **That default is the entire guard**, which is why it needs a test that fails if anyone ever switches it on for one convenient debugging session and leaves it.

*Test — `tests/Collega.Infrastructure.Tests/SensitiveDataLoggingDisabledTests.cs`: resolve `DbContextOptions<CollegaDbContext>`, assert `FindExtension<CoreOptionsExtension>()!.IsSensitiveDataLoggingEnabled` is false, with the SPEC citations in the assertion message. Hermetic — building options opens no connection. Add a matching comment at the `UseNpgsql` line pointing at the test.*

### Slice 7 — Auth and AI provider events

**(a) `src/Collega.Infrastructure/Auditing/EfAuditEventWriter.cs`** gains `ILogger<EfAuditEventWriter>`. Every auth outcome and every AI turn already funnels through this one `WriteAsync`, so **one constructor change buys the whole category** — the reason log call sites stay out of the Application layer entirely (see Blast radius below). Level: `Warning` when `EventType` ends in `"Failed"`, else `Information`. Log event type, entity, ids, and the server-authored `Message`. **`MetadataJson` is deliberately excluded** — it is free-form and carries, among other things, the normalized email of a failed login attempt.

**(b) `src/Collega.Infrastructure/Ai/AnthropicIdeaDraftModel.cs`** gains a fifth **optional, last** constructor parameter `ILogger<AnthropicIdeaDraftModel>? logger = null` defaulting to `NullLogger`, so `tools/Collega.AiPlayground/Program.cs`'s positional four-arg construction is untouched while MS DI still injects the real logger in the app.

Log points, all content-free: Debug before the call (model, effort, transcript entry count); Information after (in-scope, token counts, elapsed ms); Warning on failure with **`{ExceptionType}` and `{StatusCode}` only, never the exception object** — the SDK's exception message can carry the raw HTTP response body, and rule 28 says the API key is never logged. Never logged: system prompt, transcript, draft fields, scope statement, API key. Identity arrives free from slice 5's `LogContext`, so this class stays vendor-only and identity-free.

*Test — `AuditEventLoggingTests.cs`: an audit event whose `metadataJson` is `{"email":"victim@example.com","token":"SECRET"}` renders a line containing the event type but* neither *literal. Plus a `[Theory]` over event-type → level.*

### Slice 8 — The redaction suite

New: `tests/Collega.API.Tests/Logging/SecretRedactionTests.cs`. Drives the **real pipeline** through `CollegaApiFactory` and asserts over `factory.CapturedLogs`, rendering every captured event (message + all property values, recursively) to one string via a shared `AssertNotLogged(factory, params string[])` helper.

| Case | Drives | Asserts absent | Authority |
|---|---|---|---|
| Failed login | `POST /auth/login`, wrong password | that plaintext | `20-feature-auth.md:40` |
| Successful login | `POST /auth/login` | plaintext **and** the issued bearer token | `40-test-strategy.md` |
| Change password | `POST /auth/change-password` | old and new plaintext | `20-feature-auth.md:40` |
| Temporary password | `POST /users/{id}/temporary-password` | the generated password | `20-feature-auth.md:40` |
| CSV user import | import with a marker cell | marker, raw CSV, initial passwords | `40-test-strategy.md` |
| CSV validation failure | an invalid CSV | same — the error path is where file contents usually leak | `40-test-strategy.md` |
| AI turn | `AiConfiguredApiFactory`, transcript containing `CONFIDENTIAL-PROMPT-MARKER` | the marker and the API key | `20-feature-ai-idea-assist.md` rules 27–28 |
| Token in query string | `GET /auth/me?access_token=LEAKY-TOKEN-VALUE` | that value — proves `{RequestPath}` drops the query | `40-test-strategy.md` |

## Blast radius

**`tests/Collega.Application.Tests/` is untouched, by design.** Keeping every log call site at the API boundary and in Infrastructure is what avoids threading `ILogger<T>` through ~14 `CreateSut()` helpers. The only existing test line that changes is `tests/Collega.Infrastructure.Tests/EfAuditEventWriterTests.cs:18`, which gains `NullLogger<EfAuditEventWriter>.Instance`. `StartupConfigurationValidatorTests.cs` is untouched, also by design.

## Documentation

- **`src/Collega.API/CLAUDE.md`** — a `## Logging` section in the same per-key table format the `Ai:*` block uses, stating: `Logging:LogLevel` no longer does anything; **never add a logging key to `StartupConfigurationValidator`**; the file sink is configured **in code, not `Serilog:WriteTo`**, and that is load-bearing for test hermeticity; `WriteTo` lives in one file only because Serilog merges config arrays by index; the correlation-ID contract; and what is never logged, with SPEC citations and a pointer to `SecretRedactionTests`.
- **`tests/CLAUDE.md`** — extend the integration-harness section, modelled on its existing `Ai__ApiKey` paragraph.
- **`SPEC/30-Contracts.md`** — the `X-Correlation-ID` header contract, written in slice 2 before the code.

## Definition of Done

Per `SPEC/90-definition-of-done.md`, plus:

- [ ] `dotnet build Collega.sln` and `dotnet test Collega.sln` green; the pre-existing suite still passes unchanged
- [ ] **Zero log files written during `dotnet test`** — `git status --porcelain` clean afterwards, no `logs/` directory anywhere in the repo
- [ ] Every redaction case in slice 8 passes, and each cites the SPEC line it enforces
- [ ] `EnableSensitiveDataLogging` is off and structurally guarded by a test
- [ ] Verified **in the running app**, not only by the suite (standing rule): a correlation ID supplied on the request appears identically in the response header, the problem-details `traceId`, and the log line; a View As session logs both `UserId` and `RealUserId`; EF SQL shows parameters as `?`; an AI turn logs metrics but no prompt text; the signed-in password appears nowhere in the file
- [ ] Package approval recorded in `SPEC/implementation-agent-tracker.md` → Locked decisions, with the transitive `Serilog` core version confirmed at restore
- [ ] Code Reviewer sign-off (mandatory — auth path, third-party credential, request pipeline)
- [ ] API process stopped before the session ends

## Risks

1. **The `Program.cs` rewrite.** Wrapping ~150 lines of top-level statements in `try/catch/finally` is the largest diff here and the one most likely to break the `return 1` path, seeding, or `WebApplicationFactory`. Ship slice 1 alone with the whole suite as its gate; keep the local functions after the try block and the `partial class Program` shim last.
2. **Test-host filesystem writes.** `WebApplicationFactory` runs as Development, so a naive config writes real files into the repo on every `dotnet test`. Guarded three ways — but a JSON `WriteTo: File` bypasses all three, since that path is not a DI registration.
3. **`EnableSensitiveDataLogging` + EF Debug.** One convenience call would dump password hashes and reset tokens into a rolling file a developer might attach to a bug report. Slice 6's structural test is the only thing preventing it.
4. **Client-supplied correlation ID.** Echoed in a header and rendered client-side; unvalidated it is header injection plus log forging. The charset/length rule is not optional.
5. **Serilog replaces the MEL providers** — `Logging:LogLevel` silently stops working, and anyone tuning levels there afterwards concludes logging is broken. Delete both sections in the same commit.
6. **Serilog merges config arrays by index** — a `WriteTo` array in the Development file mutates the console entry rather than appending.
7. **`HostAbortedException`** — without the `when` filter every `dotnet ef` command becomes a Fatal and a non-zero exit, breaking the migration commands in `src/Collega.Infrastructure/CLAUDE.md`.
8. **Version drift** — 8.0.3's transitive core major needs verifying at restore; a mismatch shows as `NU1605` or a missing `CreateBootstrapLogger` overload. Fallback 8.0.1.
9. **Dev noise and test runtime** — `Default: Debug` plus EF Debug is a statement per query. Acceptable in Development by design; if `dotnet test` runtime regresses, raise `Serilog__MinimumLevel__Default` in the factory too.
10. **AI provider exception bodies** — the SDK message can carry the raw HTTP response. Logging type + status rather than the exception object is the guard; slice 8 covers the happy path but cannot cover an arbitrary provider error body, so this stays a review discipline enforced by a code comment.
