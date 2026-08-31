# 03 — What ports, and what doesn't?

Type: grilling
Status: open
Blocked by: —

## Question

Everything currently shipping has a TypeScript counterpart. Is anything deliberately left behind to shrink the first cut?

## Options — check anything you want deferred or dropped

- [ ] **AI idea assist** → Anthropic TypeScript SDK. Low risk, arguably better than the .NET path.
- [ ] **Prompt playground + eval harness** → recent arrivals on `origin/dev` (`44ac4eb`, `6c5c722`, `88afb29`) plus the versioned Site-Admin-managed prompt (`335ed6f`). Internal tooling; the most defensible thing to defer.
- [ ] **Portrait images** → `sharp`. Low risk. Note this *removes* the ImageSharp 3.1.x licensing constraint entirely — a small win.
- [ ] **CSV import** → `csv-parse`. Low risk. The product rule must survive: user import direct, idea import through View As.
- [ ] **Rate limiting** → `@nestjs/throttler`. Low risk.
- [ ] **JWT auth** → `@nestjs/jwt`. Low risk mechanically; see `08` for the real question.
- [ ] **View As impersonation** → request-scoped provider or `AsyncLocalStorage`. **High risk — see `07`.** Deferring this means shipping without Site Admin support, which is probably not viable.

**Recommended: check nothing** — everything ports, but View As gets its own slice rather than riding along inside the auth work.

## Background

Five of the six subsystems are routine substitutions. View As is not, and the tracker flags its chokepoint as load-bearing twice. The playground and eval harness are the genuinely open question here: they landed recently, they are absent from both tracker lineages' summaries, and they are developer tooling rather than product surface — so they are the one place where "defer" is a reasonable answer rather than a retreat.

Asked during charting, not answered.
