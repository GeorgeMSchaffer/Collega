# Feature: Idea-Type Field Sets (Per-Type Field Visibility)

## Overview

Today every idea in an organization shows the *same* set of User-Defined Fields (UDFs) — the schema is org-wide and shared across all boards (`SPEC/20-feature-user-defined-fields.md`). This feature lets an organization control **which UDFs appear on an idea based on its Idea Type**, so a *Continuous Improvement* idea can show a different, tighter set of fields than a *Process Revision* one.

The mechanism is a reusable **Field Set**: a named, ordered selection of existing org UDFs, each marked required-or-optional *within that set*. Each Idea Type points at one Field Set; many types may share the same set. An idea's type is chosen at creation and never changes, so the field list is resolved once and never has to reconcile.

This is the realization of the UDF spec's *"Template Integration — Forward Compatibility"* note — with one deliberate reinterpretation (see [Impact on Existing Specs](#impact-on-existing-specs)): a "template" here is a **field-visibility set**, not a default-value/scaffolding injector.

---

## Design Decisions (Interview-Resolved)

| Decision | Resolution |
|---|---|
| Core pain being solved | **Form clutter** — hide UDFs irrelevant to the type. *Not* new type-specific fields, scaffolding, or reporting. |
| Vary fields on which axis | **Idea Type** (not board, not team) |
| Idea type mutability | **Immutable** — set at creation, never changed. Eliminates value-orphaning entirely. |
| Field sets reused across types | **Yes** — multiple idea types may point at the same Field Set. Justifies a first-class, reusable `FieldSet` entity rather than folding fields directly onto the type. |
| Do types own their own *new* fields? | **No** — a Field Set only *selects from* the existing org UDF pool. The pool stays single and shared. |
| Required-ness | Moves to the **set↔field link** as a per-set override, with the field's global `IsRequired` kept as the default (see [The Load-Bearing Change](#the-load-bearing-change-required-ness)). |
| Unassigned type | Shows **all active org UDFs** (backward-compatible default). |

---

## Problem Statement

Idea forms show every organization UDF regardless of the kind of idea being filed, so people filling out a *Continuous Improvement* idea wade past fields that only make sense for other work, and admins have no way to tailor the form. The cost is friction and dirty data: irrelevant fields get skipped, guessed at, or filled with noise. As organizations add more UDFs, the single shared form gets worse for everyone.

---

## Goals

1. **Cut irrelevant fields per idea.** An idea shows only the UDFs its type's Field Set includes — measured as a reduction in fields rendered on a typed idea form versus the full org pool.
2. **Give admins per-type control** over which UDFs appear and which are required, without duplicating field definitions.
3. **Reuse without duplication.** Two or more idea types can share one Field Set; changing that set updates every type that uses it.
4. **Zero data loss and zero form-reconciliation risk**, achieved by making idea type immutable at creation.
5. **Backward compatibility**: existing ideas and orgs with no Field Sets behave exactly as they do today (all fields shown).

---

## Non-Goals

- **Types owning their own distinct new fields.** The org UDF pool stays single and shared; Field Sets only *select* from it. (Pain is clutter, not missing capture — out of scope.)
- **Description scaffolding / default field values / prefilled content.** A Field Set controls visibility and required-ness only, not initial values. ("Faster idea entry" was explicitly not a driver.)
- **Editable idea type after creation** and the value-reconciliation that would require. Immutability is a hard v1 constraint.
- **Field Set versioning / history.** A set is mutable in place; there is no snapshotting of "which fields a set had when this idea was created."
- **Board- or team-scoped field variation.** Type is the only axis in v1.
- **Business Impact field sets.** Only `IdeaType` gains a Field Set; `BusinessImpact` stays a simple option list.

---

## User Stories

**Admin (OrgAdmin / SiteAdmin)**
- As an org admin, I want to create a named Field Set that includes a chosen subset of our UDFs so that I can tailor which fields apply to a kind of idea.
- As an org admin, I want to mark each field in a set as required or optional *for that set* so that a field can be mandatory for one type of idea and absent from another.
- As an org admin, I want to assign a Field Set to an Idea Type so that ideas of that type show only that set's fields.
- As an org admin, I want to reuse one Field Set across multiple Idea Types so that I don't rebuild the same selection twice.
- As an org admin, I want an Idea Type with no assigned set to keep showing all fields so that nothing breaks before I've configured sets.

**Idea author (User)**
- As a user creating an idea, I want to pick the idea type and then see only the fields that apply so that the form isn't cluttered with irrelevant inputs.
- As a user, I want required fields for my idea's type enforced on save so that I don't file incomplete ideas.

**Idea viewer (User / ReadOnly)**
- As a viewer, I want an idea's detail page to show the fields that belong to its type (plus any historical values), so the record reads cleanly.

---

## Domain Model

### New entity: `FieldSet` (`AuditableEntityBase`)

Org-scoped, reusable. Owns an ordered collection of links to existing `FieldDefinition`s.

```csharp
public sealed class FieldSet : AuditableEntityBase
{
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; }            // unique per org among active sets
    public string? Description { get; private set; }
    public bool IsDeleted { get; private set; }

    private readonly List<FieldSetField> _fields = new();
    public IReadOnlyList<FieldSetField> Fields => _fields;

    // Create / Rename / SetFields(reconcile links) / SoftDelete — factory + invariant methods,
    // matching the existing FieldDefinition pattern.
}
```

### New link entity: `FieldSetField` (`EntityBase`)

The set↔field association. **This is where per-set required-ness lives.**

```csharp
public sealed class FieldSetField : EntityBase
{
    public Guid FieldSetId { get; private set; }
    public Guid FieldDefinitionId { get; private set; }
    public int DisplayOrder { get; private set; }      // order within THIS set
    public bool IsRequired { get; private set; }       // required WITHIN this set (overrides global default)
}
```

- Unique on `(FieldSetId, FieldDefinitionId)` — a field appears at most once per set.
- `DisplayOrder` is per-set, so the same field can sit in different positions in different sets.

### Modified entity: `IdeaType`

Gains an optional Field Set reference. Null = "show all active org UDFs" (backward-compatible).

```csharp
public Guid? FieldSetId { get; private set; }
public void AssignFieldSet(Guid? fieldSetId, DateTime nowUtc, Guid? actorUserId);
```

Many idea types may reference the same `FieldSetId`.

### Modified entity: `Idea` — already carries the type, but it is currently mutable

**Ground-truth correction (verified against `dev`):** `Idea` **already has** a required `IdeaTypeId` (and `BusinessImpactId`), set at creation via `SetClassification(...)`, backfilled onto existing rows by the `AddIdeaClassification` migration. So the "wire the type onto ideas" prerequisite is **done** — this feature does *not* re-add it.

The one gap versus the interview decision: `Idea.UpdateContent(...)` **currently re-applies classification on every edit** (`SetClassification(ideaTypeId, businessImpactId)`), so idea type is today **editable**. The immutable decision therefore requires an actual, small change:

```csharp
// P0 change: make idea type immutable after creation.
// Option (chosen): drop ideaTypeId from UpdateContent's signature entirely — the update path
// stops touching classification. (BusinessImpact mutability is out of scope; leave it as-is or
// split it out.) The Application layer rejects an update whose ideaTypeId differs from the stored one.
```

- No new column or migration for `IdeaTypeId` — it exists.
- Enforcing immutability is a domain + application change (remove type from the edit path; reject a differing `ideaTypeId` on update with `400`), plus a regression test. This is why the effort table has a small "immutability" line rather than a full "add the field" line.

### Reuse of the existing archived-value mechanism

The update path already reconciles field values against a *scoped* definition set — `Idea.ReplaceFieldValues(values, reconciledFieldDefinitionIds, …)` only clears values for the definitions in scope, preserving everything else. Resolving to a *type's* field set is the same shape: the reconcile scope becomes "the fields in this idea's type's set." No new domain primitive is needed for reconciliation — the scoping parameter already covers it.

---

## The Load-Bearing Change: Required-ness

Today `FieldDefinition.IsRequired` is global and `FieldValueValidator` enforces it across **every** active org field. The moment a type's set *excludes* a globally-required field, validation would reject every idea of that type — a contradiction. So required-ness must be resolvable **per set**.

**Decision (refinement of the interview "relocate" call):** required-ness becomes a **per-set override with a global default**, not a hard relocation:

- `FieldSetField.IsRequired` is authoritative for a field **when the idea's type resolves to a set**.
- `FieldDefinition.IsRequired` is retained as:
  1. the **default** applied when an idea type is **unassigned** (resolves to "all fields"), and
  2. the **seed** value pre-filled when a field is first added to a set (admin can then override).

This keeps existing orgs (no sets) behaving exactly as before, while giving sets full control. Fully dropping the global flag is deferred (see [Open Questions](#open-questions)).

### Effective-field resolution (the core algorithm)

One function — `ResolveEffectiveFields(ideaTypeId) → IReadOnlyList<(FieldDefinition field, bool required)>` — is the single source of truth consumed by the idea form, the validator, and the detail projection. Given an idea's `IdeaTypeId`:

1. Look up the `IdeaType`. If the type itself is soft-deleted (a stored idea may point at an archived type), still resolve its set — archival of the *type* does not change an existing idea's field schema.
2. **Unassigned** (`IdeaType.FieldSetId is null`) → effective fields = **all active** org `FieldDefinition`s, ordered by global `DisplayOrder` then `Name` (stable tie-break), `required = FieldDefinition.IsRequired`.
3. **Assigned** → effective fields = the set's `FieldSetField` links **whose `FieldDefinition` is active (not soft-deleted)**, ordered by `FieldSetField.DisplayOrder` then the field's `Name`, `required = FieldSetField.IsRequired`.
4. A soft-deleted `FieldDefinition` never appears in either branch — even if a link still references it (the link is retained but filtered at resolution, mirroring how archived UDFs are handled today).

**Required-ness resolution table:**

| Idea type state | Field source | `required` comes from |
|---|---|---|
| No set assigned | all active org fields | `FieldDefinition.IsRequired` (global) |
| Set assigned, field in set | set's active links | `FieldSetField.IsRequired` (per-set override) |
| Set assigned, field *not* in set | — (field is hidden for this type) | n/a — value submission for it is rejected `400` |

**Value scoping (write path):** a submitted value is accepted only if its `fieldDefinitionId` is in the resolved set for the idea's type; otherwise `400`. Required fields in the resolved set that are empty block the save. Because the write path reconciles against exactly the resolved-set ids (passed as `ReplaceFieldValues`' `reconciledFieldDefinitionIds`), values for fields outside the current resolution — e.g. a field later removed from the set — are **preserved untouched**, never silently dropped.

---

## Application Layer

### New service: `IFieldSetService` (`Collega.Application/FieldSets/`)

Admin-only (OrgAdmin in-scope, or SiteAdmin), matching `FieldDefinitionService`'s authorization exactly (`EnsureAdminScope`). CRUD + membership + assignment:

| Method | Purpose |
|---|---|
| `ListAsync(orgId, includeDeleted)` | List sets for the org |
| `GetAsync(orgId, id)` | One set with its ordered field links |
| `CreateAsync(orgId, cmd)` | Create a named set with an initial ordered field selection |
| `UpdateAsync(orgId, id, cmd)` | Rename/redescribe; reconcile field membership, per-set order, and per-set required flags |
| `DeleteAsync(orgId, id)` | Soft-delete a set (see reference rule below) |

Validation rules:
- Name required, ≤100 chars, unique per org among active sets (mirror `FieldDefinition` name uniqueness).
- Every `fieldDefinitionId` in a set must be an **active** field definition in the same org (else `400`).
- No duplicate field in a set.
- **Referenced-set deletion:** a set assigned to one or more active idea types cannot be deleted until those types are reassigned (else `409 Conflict`). (Alternative — soft-delete and fall types back to "all" — is rejected as too implicit.)

### `IdeaType` assignment

Extend the existing Idea Type admin surface (currently `IdeaTypesController` / the Idea Field Options service) with a set-assignment operation:
- `PUT .../idea-types/{id}/field-set` with body `{ "fieldSetId": "<guid|null>" }`. Null clears the assignment (type falls back to "all fields").

### `IdeaService` changes

- **Create:** `CreateIdeaCommand` **already carries `IdeaTypeId`** (no signature change). Change: resolve effective fields for that type and validate submitted values against the **resolved** set, instead of against the full active-definition list.
- **Validator:** `FieldValueValidator.Validate(...)` takes the **resolved effective fields** (each carrying its effective `IsRequired`) instead of the raw active-definition list. A submitted value for a field outside the resolved set → `"<fieldName>" is not a field for this idea type.` (`400`).
- **Update:** enforce immutability — reject an update whose `ideaTypeId` differs from the stored one (`400`), or drop `ideaTypeId` from the update contract entirely. Field values reconcile against the idea type's resolved set as the scope (reusing `ReplaceFieldValues`' scoping parameter). Because type is now immutable, the resolution is stable across the idea's life. A `null` `FieldValues` still means "not provided; leave values untouched" (existing behavior).
- **Detail projection:** order and label field values by the resolved set; historical values for fields no longer in the set (e.g. a field later removed from the set) follow the same "archived value" treatment already in place — preserved, shown with an archived indicator, never silently dropped.

---

## API Endpoints

All under `/api/v1`, org-scoped, admin-only for management (mirroring `field-definitions`).

### Field Sets (Admin only)

| Method | Route | Description |
|---|---|---|
| `GET` | `/organizations/{orgId}/field-sets` | List sets (`?includeDeleted=true` for archived) |
| `POST` | `/organizations/{orgId}/field-sets` | Create a set with ordered field links |
| `GET` | `/organizations/{orgId}/field-sets/{id}` | Get a set with its fields |
| `PUT` | `/organizations/{orgId}/field-sets/{id}` | Rename/redescribe; reconcile membership, order, required flags |
| `DELETE` | `/organizations/{orgId}/field-sets/{id}` | Soft-delete (blocked if assigned to an active type → `409`) |

### Idea Type → Field Set assignment (Admin only)

| Method | Route | Description |
|---|---|---|
| `PUT` | `/organizations/{orgId}/idea-types/{id}/field-set` | Assign or clear (`{"fieldSetId": null}`) the set for a type |

### Idea payloads

`CreateIdeaRequest` already includes required `ideaTypeId` (unchanged). The embedded `fieldValues` shape is unchanged. `IdeaDetailModel` already returns `fieldValues`, now ordered/filtered by the resolved set. The idea **update** contract must not change `ideaTypeId` (immutable).

```json
// CreateIdeaRequest (excerpt — unchanged shape)
{
  "title": "...",
  "ideaTypeId": "3fa85f64-...",
  "fieldValues": [ { "fieldDefinitionId": "…", "value": "50000" } ]
}
```

---

## Client UI

### Admin: Field Sets manager

**Route:** `/organizations/{orgId}/settings/field-sets` (new item in Settings nav, admin-only).

| Component | Responsibility |
|---|---|
| `FieldSetList.razor` | List active sets; create / edit / archive; shows how many idea types use each set |
| `FieldSetEditor.razor` | Name, description, and a two-pane field picker: available org UDFs → chosen fields, with drag-reorder and a per-field **Required** toggle |

Archiving a set that's in use is blocked with a message naming the idea types still assigned.

### Admin: Idea Types

The existing Idea Types settings screen gains a **Field Set** selector per type (dropdown of active sets + "All fields (default)").

### Idea form

- The **Idea Type** selector is required and appears near the top of the create form (it drives everything below).
- The Custom Fields section renders the **resolved** fields for the selected type, in set order, with per-set required markers.
- On the Idea Detail / edit page the type is shown read-only (immutable); fields render from the resolved set. Historical values for out-of-set fields render in a muted "archived" style, consistent with soft-deleted UDFs today.

---

## Permissions

| Role | Manage Field Sets / assign to types | Pick idea type + fill fields on idea | View idea fields |
|---|---|---|---|
| `SiteAdmin` | ✅ | ✅ | ✅ |
| `OrgAdmin` | ✅ (own org) | ✅ | ✅ |
| `User` | ❌ | ✅ | ✅ |
| `ReadOnly` | ❌ | ❌ | ✅ |

---

## Requirements

### Must-Have (P0)

- **[P0] Idea type immutability.** `Idea.IdeaTypeId` already exists and is required (built via `AddIdeaClassification`); this feature makes it **immutable after creation** — today `UpdateContent` re-applies it. Change: remove idea type from the edit path (or reject a differing `ideaTypeId` on update with `400`).
  - *Given* an idea exists *When* an update carries a different `ideaTypeId` *Then* the change is rejected (`400`) or the field is not editable.
  - *Given* an idea is created *When* no type is supplied *Then* it defaults to the org's first active Idea Type (existing behavior — unchanged).
  - Note: `BusinessImpactId` mutability is **out of scope**; leave its current behavior as-is unless a follow-up decides otherwise.
- **[P0] Field Set entity + membership.** Admins can create a set that selects a subset of active org UDFs, each with a per-set order and required flag.
  - Name unique per org among active sets (`400` on duplicate).
  - A field appears at most once per set; every referenced field is active and in-org (`400` otherwise).
- **[P0] Type → set assignment.** An idea type can be assigned one set or none.
- **[P0] Effective-field resolution.** Forms, validator, and detail all use the resolution algorithm: assigned set → set's active fields in set order with per-set required; unassigned → all active fields with global required.
- **[P0] Required-ness override.** `FieldSetField.IsRequired` governs required for assigned types; `FieldDefinition.IsRequired` remains the default for unassigned types and the seed on adding a field to a set.
- **[P0] Value scoping.** Submitting a value for a field outside the idea's type's resolved set returns `400`. Required fields in the resolved set block save when empty.
- **[P0] Backward compatibility.** Orgs/ideas with no sets behave exactly as today (all fields, global required).
- **[P0] No orphaning / no loss.** Because type is immutable, no reconciliation-on-type-change exists. Values for fields later removed from a set are preserved and shown as archived (reuses existing behavior).

### Nice-to-Have (P1)

- **[P1] "Types using this set" count** surfaced in the admin list.
- **[P1] Duplicate-a-set** action to speed up creating a similar set.
- **[P1] Bulk assign** one set to multiple idea types at once.

### Future Considerations (P2)

- **[P2] Fully relocate required-ness** (drop the global `FieldDefinition.IsRequired`) once all orgs use sets.
- **[P2] Default values / scaffolding per set** (the original "template" reading — kept architecturally possible via the set entity).
- **[P2] Set versioning** so an idea can render against the set as it was at creation time.

---

## Migration Strategy

**EF migration `AddFieldSets`:**
- New tables `field_sets`, `field_set_fields` (snake_case, per Infrastructure convention).
- `idea_types` gains nullable `field_set_id` (FK → `field_sets`, `ON DELETE` restricted; deletion is guarded in the app layer anyway).
- **`ideas.idea_type_id` already exists and is already backfilled** (`AddIdeaClassification`) — no column add, no idea backfill in this migration. All existing orgs start with **no** field sets, so every idea resolves to "all fields" — identical to current behavior.
- Indexes: unique `(field_set_id, field_definition_id)` on the link; unique filtered `(organization_id, name)` where `is_deleted = 0` on `field_sets`.
- This migration touches only the new/changed tables, so it should merge cleanly against the shared `CollegaDbContextModelSnapshot` as long as no other in-flight slice adds a migration concurrently.

---

## Impact on Existing Specs

Approving this spec requires these canonical edits (do these *before* implementation, per repo working rules):

1. **`SPEC/20-feature-user-defined-fields.md`**
   - The *"Template Integration — Forward Compatibility"* section (which envisioned templates supplying **default field value stubs**) is **reinterpreted**: v1 templates are field-visibility **sets**, not default-value injectors. Default values move to a P2 future consideration. Flag and reconcile that section rather than leaving both readings live.
   - Required-fields decision row updated to note per-set override + global default.
2. **`SPEC/20-feature-ideas-and-engagement.md`** — record that idea type is now **immutable after creation** (currently editable via update) and cross-reference this spec for per-type field resolution. `IdeaTypeId` being required is already documented there.
3. **`SPEC/30-Contracts.md`** — add the `field-sets` routes and the `idea-types/{id}/field-set` assignment route. (`ideaTypeId` on `POST /ideas` is **already** in the contract; the update contract should stop accepting a changed `ideaTypeId`.)

*(No `Idea.cs` edit needed — its `<remarks>` block already describes Idea Type as modelled.)*

---

## Open Questions

- **[Eng]** Should the global `FieldDefinition.IsRequired` be dropped eventually, or kept permanently as the unassigned-type default? (P2 decides; v1 keeps it.) — non-blocking.
- **[Product]** When a field is **removed from a set** that ideas already used, confirm the archived-value display treatment is acceptable for in-set removals (it already exists for soft-deleted fields). — non-blocking; default is "yes, reuse it."
- **[Product]** Should `BusinessImpact` ever get the same set mechanism, or stay a plain option? (Currently out of scope.) — non-blocking.
- **[Eng]** Deletion of a referenced set: hard-block (`409`, chosen) vs. soft-delete-and-fallback. Confirm the block is the desired UX. — non-blocking; block is the default.

---

## Effort Sizing (backend-first, Client is a later wave per repo convention)

| Layer | Work | Estimate |
|---|---|---|
| **Domain** | `FieldSet`, `FieldSetField`, `IdeaType.FieldSetId`, **idea-type immutability** (remove from `UpdateContent`), resolution helper | S–M — 1 day |
| **Infrastructure / EF** | 2 configs, 2 new tables, `idea_types.field_set_id` add, `AddFieldSets` migration (no idea backfill — `idea_type_id` already exists) | S–M — 1 day |
| **Application** | `IFieldSetService`, resolution algorithm, `FieldValueValidator` signature change, `IdeaService` create/validate/detail wiring, type-assignment op, reject type change on update | M — 2–3 days |
| **API** | `FieldSetsController` (5 routes), type→set route, update-contract change (no `ideaTypeId` change), contracts | S–M — 1–1.5 days |
| **Tests** | Resolution (assigned/unassigned/archived), per-set required override, immutability rejection, out-of-set value rejection, referenced-set delete block | M — 2 days |
| **Client (later wave)** | Field Sets manager, type set-selector, idea-form resolved fields, read-only type on edit | M–L — 4–5 days |
| **Backend total** | | **~6–8 dev-days** |
