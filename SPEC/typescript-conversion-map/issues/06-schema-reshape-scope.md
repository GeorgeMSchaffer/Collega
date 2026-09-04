# 06 — What actually changes in the schema?

> **Unblocked 2026-09-04** by [`../findings/05-prisma-introspection.md`](../findings/05-prisma-introspection.md).
> The forced/optional line the ticket says it needs can now be drawn, and the forced side is
> short: **three partial unique indexes** re-added as raw SQL (introspection drops them and no
> Prisma workflow warns), and **relation field names**, which introspection generates as
> `impersonation_sessions_impersonation_sessions_real_user_idTousers` and are unusable as-is.
> Everything else on the option list below is optional. One item changes category: **enum
> representation** is not a preference for the two converters stored as `int`, since `0`/`1`/`2`
> carry meaning defined only in C# and nothing in the schema records it. Still open for
> decision.

Type: grilling
Status: open — unblocked 2026-09-04
Blocked by: — (was 05, answered)

## Question

"Introspect, then reshape" names an intent, not a scope. Which reshapes are actually wanted?

## Options — check each change you want made

- [ ] **EF-flavored naming** — table casing, join-table names, FK naming conventions that read oddly in Prisma
- [ ] **Audit and event tables** (`AuditEvent`, `NotificationEvent`) — currently shaped by EF conventions
- [ ] **User-defined-field storage** (`FieldDefinition` / `FieldDefinitionOption` / `IdeaFieldValue`) — the classic EAV shape. The most likely place someone reaches for `jsonb` instead. **Biggest blast radius on this list.**
- [ ] **`Status.Name` length cap** — `character varying(100)`, a judgment call recorded pre-Sprint-5 and worth re-confirming rather than inheriting silently
- [ ] **Enum representation** — EF ints versus Prisma native Postgres enums
- [ ] **Nothing optional** *(recommended until `05` lands)* — take only the reshapes that introspection *forces*, and defer the rest

## The rule to apply

Every **optional** reshape widens the gap that `04`'s validation strategy has to cover. Forced reshapes are free — you have no choice. Optional ones are cheap to decide now and expensive to verify later. Bias hard toward "not now."

## Blocked by `05`

Some reshapes are **forced** (introspection loses something, so it must be re-expressed by hand) and some are **optional** (someone would simply prefer it). Until the research in `05` lands, those two categories are indistinguishable — and only the second kind is worth arguing about. Do not resolve this ticket first.
