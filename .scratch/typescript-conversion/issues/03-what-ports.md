# 03 — What ports, and what doesn't?

Type: grilling
Status: open
Blocked by: —

## Question

Six .NET-specific subsystems need TypeScript counterparts. Five are routine substitutions:

| Subsystem | TS counterpart | Risk |
|---|---|---|
| AI idea assist | Anthropic **TypeScript SDK** | Low — arguably better than the .NET path |
| Portrait images | `sharp` | Low, but native — echoes the ImageSharp/SkiaSharp Linux lesson |
| CSV import | `csv-parse` | Low |
| Rate limiting | `@nestjs/throttler` | Low |
| JWT auth | `@nestjs/jwt` | Low, but see `08` |
| **View As impersonation** | request-scoped provider / `AsyncLocalStorage` | **High — see `07`** |

Also unresolved: the prompt playground and eval harness that landed on `origin/dev` (`44ac4eb`, `6c5c722`, `88afb29`) and the versioned Site-Admin-managed AI prompt (`335ed6f`). These are recent, real, and absent from both tracker lineages' summaries — they need a disposition rather than being discovered mid-conversion.

Two further items with .NET-shaped answers: **ImageSharp's licensing constraint** (pinned to the 3.1.x Split License line) disappears entirely under `sharp`, which is a small win worth recording; and the **CSV import split** (user import direct, idea import through View As) is a product rule that must survive the port intact.

**Resolve by:** confirming everything ports, or naming what is deferred or dropped to shrink the first cut — with the consequence of each stated.

Asked during charting, not answered.
