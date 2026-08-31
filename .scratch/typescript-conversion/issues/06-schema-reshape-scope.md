# 06 — What actually changes in the schema?

Type: grilling
Status: open
Blocked by: 05

## Question

"Introspect, then reshape" (decision 7) names an intent, not a scope. Reshaping is what forfeits "same data, same answers" as a correctness check, so every change has to earn its place individually.

**Resolve by:** an explicit list of schema changes, each with a justification — and, just as importantly, the changes explicitly **not** being made.

Candidates worth putting to the user:

- EF-flavored naming that reads oddly in Prisma (table casing, join-table names, FK naming)
- The audit and event tables (`AuditEvent`, `NotificationEvent`) — currently shaped by EF conventions
- **User-defined-field storage** (`FieldDefinition` / `FieldDefinitionOption` / `IdeaFieldValue`) — the classic EAV shape, and the most likely place someone will want to reach for `jsonb` instead. Big decision, big blast radius.
- `Status.Name` capped at `character varying(100)` — a judgment call recorded pre-Sprint-5 and worth re-confirming rather than inheriting silently
- Anything the Sprint 5 post-mortem flagged as awkward under Postgres

Needs `05` first: some reshapes are **forced** (introspection loses something, so it must be re-expressed) and some are **optional** (someone would just prefer it). Until the research lands those two categories are indistinguishable, and only the second kind should be argued about.

Guidance to carry into the conversation: every optional reshape widens the gap that `04`'s validation strategy has to cover. Cheap to decide now, expensive to verify later.
