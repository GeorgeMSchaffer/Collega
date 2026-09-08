# Collega.Domain

> # ⛔ FROZEN — this describes the .NET stack, which is being replaced
>
> **Everything below is no longer applicable guidance.** It documents `src/Collega.*`, the .NET
> application the TypeScript conversion replaces (`SPEC/decisions.md` 2026-09-06). Read it only to
> understand what the old code *did* — never as a pattern to follow, and never as the house style.
>
> **Do not** fix bugs, add features, write tests, add migrations or refactor anything in `src/` or
> `tests/`. A defect found here is recorded against the TypeScript port instead.
>
> Build against `packages/{domain,application,infrastructure}` and `apps/{api,web}`. The .NET code
> stays on disk only so a golden fixture can still be re-recorded, and is deleted in slice **F6**
> once F1 replays clean.

Entities, enums, value objects, and invariants. **Depends on nothing** — no EF Core, no ASP.NET, no reference to Application, Infrastructure, API, or Client. If a rule needs a database or an HTTP context, it doesn't belong here.

## Layout

| Folder | Holds |
|---|---|
| `Common/` | `EntityBase`, `AuditableEntityBase` — shared identity and audit-stamp base types |
| `Enums/` | `Role` (Site Admin → Org Admin → User → Read Only), `UserStatus` |
| `Organizations/` | `Organization`, including its regenerable invite code |
| `Users/` | `User`, plus the pure policy helpers below |
| `Auditing/` | `AuditEvent` |

## Rules that live here

- **`EmailNormalizer`** — email is globally unique across the whole system; normalize through this type before any comparison or persistence so uniqueness checks agree.
- **`PasswordPolicy`** — complexity rules. The single place password strength is defined.
- **`TemporaryPasswordGenerator`** — admin-issued temporary passwords.
- **Invariants belong on the entity.** Enforce state transitions (lockout counters, `MustChangePassword`, status changes) in the entity's own methods rather than letting callers set properties freely.

Deliberately keep this layer free of randomness and ambient time — take an `IClock` value or an explicit timestamp from the caller so `tests/Collega.Domain.Tests` stays hermetic.

Canonical behavior is in `SPEC/20-feature-auth.md` and `SPEC/20-feature-organizations-and-users.md`.
