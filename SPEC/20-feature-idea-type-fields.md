# Feature: Idea-Type Fields (Per-Type Field Selection)

> **Model note (2026-08-10 rewrite).** This spec previously proposed a reusable **Field Set** entity as the indirection between idea types and fields. That model was **superseded by direct type→field mapping** (interview-resolved — see Design Decisions). Fields attach straight to an `IdeaType`; there is no separate "field set" concept. This file was renamed from the earlier `20-feature-idea-type-field-sets.md`; all cross-references were updated. Where this document says "the type's fields," it means the type's directly-mapped field selection.

## Overview

Today every idea in an organization shows the *same* set of User-Defined Fields (UDFs) — the schema is org-wide and shared across all boards (`SPEC/20-feature-user-defined-fields.md`). This feature lets an organization control **which UDFs appear on an idea based on its Idea Type**, so a *Continuous Improvement* idea can show a different, tighter set of fields than a *Process Revision* one.

The mechanism is **direct mapping**: an `IdeaType` owns an ordered selection of the org's existing UDFs, each marked required-or-optional *for that type*. The org's field pool stays single and shared — a field can be mapped onto several types and still reports as one field — but each type curates its own subset. An idea's type is chosen at creation and (for regular users) never changes, so the field list resolves once and never has to reconcile.

This is the realization of the UDF spec's *"Template Integration — Forward Compatibility"* note, with a deliberate reinterpretation: a "template" here is a **field-visibility selection**, not a default-value/scaffolding injector.

**Idea Types already exist.** `IdeaType` is a shipped, org-scoped entity (`Collega.Domain.IdeaFields.IdeaType`), `Idea.IdeaTypeId` is required and backfilled (`AddIdeaClassification`), and there is an `IdeaTypesController`. This feature adds the field mapping, the type badge (color + icon), immutability, and the admin reassign hatch — it does **not** invent the type concept.

---

## Design Decisions (Interview-Resolved)

| Decision | Resolution |
|---|---|
| Core pain being solved | **Form clutter** — hide UDFs irrelevant to the type. Not new type-specific fields, not scaffolding, not reporting. |
| Vary fields on which axis | **Idea Type** (not board, not team) |
| Field↔type wiring | **Direct mapping** — a new `IdeaTypeField` link attaches org fields straight to the type. No reusable "field set" intermediary. |
| Do types own their own *new* fields? | **No** — mapping only *selects from* the existing org UDF pool. The pool stays single and shared. |
| Idea type mutability | **Immutable at creation** for regular users. **Admin-only "reassign type"** break-glass (P1) rescues a mis-typed or stranded idea, reusing the archived-value mechanism. |
| Type visual identity | Type gains **color + icon**, rendered as a badge on cards, the ideas list, and idea detail (reuses the status color picker). |
| Required-ness | Per-type override on the `IdeaTypeField` link, with the field's global `IsRequired` as the default for types in "all fields" mode. |
| Backward compatibility / new-field propagation | A type has a **field mode**: `AllActiveFields` (default) shows every active org field; `Curated` shows only mapped fields. Migration sets existing types to `AllActiveFields`, so nothing changes and new org fields still auto-appear — until an admin curates a type. |
| Delete an in-use type | **Soft delete** (archive) — existing ideas keep resolving against the archived type; it leaves the create picker. Consistent with UDF/status soft-delete. |
| Delete the last type | **Blocked** — every org keeps ≥1 active type (`IdeaType.MinimumActiveOptionsPerOrganization = 1`, already enforced). |

---

## Problem Statement

Idea forms show every organization UDF regardless of the kind of idea being filed, so people filling out a *Continuous Improvement* idea wade past fields that only make sense for other work, and admins have no way to tailor the form. The cost is friction and dirty data: irrelevant fields get skipped, guessed at, or filled with noise. As organizations add more UDFs, the single shared form gets worse for everyone.

---

## Goals

1. **Cut irrelevant fields per idea.** An idea shows only the UDFs its type maps — measured as a reduction in fields rendered on a curated typed idea form versus the full org pool.
2. **Give admins per-type control** over which UDFs appear and which are required, without duplicating field definitions.
3. **Keep the field pool shared.** A field mapped onto multiple types is still one definition, one value column, one reporting/filter target.
4. **Make types visible.** Color + icon badge so a card's type reads at a glance, tied into the same visual system as statuses and priority.
5. **Zero data loss.** Immutability plus the archived-value mechanism means no field value is ever silently dropped, even on admin reassignment.
6. **Backward compatibility.** Existing ideas and un-curated types behave exactly as today (all active fields shown, global required).

---

## Non-Goals

- **Types owning their own distinct *new* fields.** The org UDF pool stays single and shared; types only *select* from it. (Pain is clutter, not missing capture.)
- **A reusable field-set entity.** Rejected in favor of direct mapping; the marginal reuse benefit didn't justify a second admin surface and a new concept. (Reuse of a *selection* across types is a possible P2 "copy fields from another type" convenience, not a shared entity.)
- **Description scaffolding / default field values / prefilled content.** Mapping controls visibility and required-ness only.
- **Editable idea type after creation for regular users.** Immutability is a hard v1 constraint; the admin reassign hatch is the only exception.
- **Type carrying a default board / workflow / assignees.** Type = field selection + badge. Not "workflow types."
- **Board- or team-scoped field variation.** Type is the only axis in v1.

---

## User Stories

**Admin (OrgAdmin / SiteAdmin)**
- As an org admin, I want to choose which of our UDFs appear on a given idea type, and in what order, so the form fits the work.
- As an org admin, I want to mark each mapped field required or optional *for that type* so a field can be mandatory for one type and absent from another.
- As an org admin, I want to give a type a color and icon so its ideas are recognizable at a glance.
- As an org admin, I want an un-curated type to keep showing all fields so nothing breaks before I've tailored it.
- As an org admin, I want to reassign a mis-typed idea's type as a break-glass action, without losing its field values or its comment/upvote history.

**Idea author (User)**
- As a user creating an idea, I want to pick the idea type and then see only the fields that apply so the form isn't cluttered.
- As a user, I want required fields for my idea's type enforced on save so I don't file incomplete ideas.

**Idea viewer (User / ReadOnly)**
- As a viewer, I want an idea's detail page to show the fields that belong to its type (plus any historical values), so the record reads cleanly.

---

## Domain Model

### Modified entity: `IdeaType` (`Collega.Domain.IdeaFields`, `AuditableEntityBase`)

Already shipped with `OrganizationId`, `Name`, `SortOrder`, `IsDeleted`, and soft-delete/rename/reorder methods. This feature adds:

```csharp
public string? ColorHex { get; private set; }     // 7-char #RRGGBB, nullable → falls back to a neutral badge
public string? Icon { get; private set; }          // short token (emoji or icon key), nullable
public IdeaTypeFieldMode FieldMode { get; private set; } // AllActiveFields (default) | Curated

private readonly List<IdeaTypeField> _fields = new();
public IReadOnlyList<IdeaTypeField> Fields => _fields;

// New/extended invariant methods:
// SetAppearance(colorHex, icon, …)
// SetFieldSelection(IReadOnlyList<IdeaTypeFieldInput> links, …)  → replaces _fields, sets FieldMode = Curated
// ClearFieldSelection(…)                                         → empties _fields, sets FieldMode = AllActiveFields
```

```csharp
public enum IdeaTypeFieldMode
{
    AllActiveFields = 0, // backward-compatible default: show every active org field, global IsRequired
    Curated = 1,         // show only mapped IdeaTypeField links, per-link IsRequired
}
```

### New link entity: `IdeaTypeField` (`EntityBase`)

The type↔field association. **Per-type required-ness and order live here.**

```csharp
public sealed class IdeaTypeField : EntityBase
{
    public Guid IdeaTypeId { get; private set; }
    public Guid FieldDefinitionId { get; private set; }
    public int DisplayOrder { get; private set; }   // order within THIS type
    public bool IsRequired { get; private set; }     // required WITHIN this type (overrides global default)
}
```

- Unique on `(IdeaTypeId, FieldDefinitionId)` — a field appears at most once per type.
- `DisplayOrder` is per-type; the same field can sit in different positions on different types.
- A link whose `FieldDefinition` is soft-deleted is retained but filtered at resolution (mirrors archived-UDF handling).

### `Idea` — type already wired; make it immutable

**Ground truth (verified against `dev`):** `Idea` already has a required `IdeaTypeId`, set at creation via `SetClassification(...)` and backfilled by `AddIdeaClassification`. The gap: `Idea.UpdateContent(...)` **currently re-applies classification on every edit**, so type is editable today.

- **P0 change:** drop `ideaTypeId` from the `UpdateContent` path so a normal edit never changes type; the Application layer rejects an update whose `ideaTypeId` differs from the stored value (`400`). (`BusinessImpactId` mutability is out of scope — leave as-is.)
- **Admin reassign (P1):** a separate, admin-only operation sets a new `IdeaTypeId`, re-resolves fields, archives out-of-scope values, and emits an audit event. This is the *only* path that mutates type post-creation.
- No new column or migration for `IdeaTypeId` — it exists.

### Reuse of the existing archived-value mechanism

`Idea.ReplaceFieldValues(values, reconciledFieldDefinitionIds, …)` already clears only the values for definitions *in scope*, preserving the rest. Resolving to a type's mapped fields is the same shape: the reconcile scope becomes "the fields resolved for this idea's type." No new reconciliation primitive is needed — including for admin reassignment, where the new type's resolved fields become the scope and everything else is preserved as archived.

---

## Effective-field resolution (the core algorithm)

One function — `ResolveEffectiveFields(ideaType) → IReadOnlyList<(FieldDefinition field, bool required)>` — is the single source of truth consumed by the idea form, the validator, and the detail projection. Given an idea's `IdeaType` (resolve its set even if the *type* is soft-deleted — archival of the type doesn't change an existing idea's schema):

1. **`FieldMode == AllActiveFields`** → effective fields = **all active** org `FieldDefinition`s, ordered by global `DisplayOrder` then `Name`, `required = FieldDefinition.IsRequired`.
2. **`FieldMode == Curated`** → effective fields = the type's `IdeaTypeField` links **whose `FieldDefinition` is active**, ordered by `IdeaTypeField.DisplayOrder` then the field's `Name`, `required = IdeaTypeField.IsRequired`.
3. A soft-deleted `FieldDefinition` never appears in either branch, even if a `Curated` link still references it (link retained, filtered at resolution).

**Required-ness resolution table:**

| Type field mode | Field source | `required` comes from |
|---|---|---|
| `AllActiveFields` | all active org fields | `FieldDefinition.IsRequired` (global) |
| `Curated`, field mapped | type's active links | `IdeaTypeField.IsRequired` (per-type override) |
| `Curated`, field *not* mapped | — (hidden for this type) | n/a — value submission for it is rejected `400` |

**Value scoping (write path):** a submitted value is accepted only if its `fieldDefinitionId` is in the resolved set for the idea's type; otherwise `400`. Required fields in the resolved set that are empty block the save. Because the write path reconciles against exactly the resolved ids (passed as `ReplaceFieldValues`' `reconciledFieldDefinitionIds`), values for fields outside the current resolution — e.g. a field later removed from the type, or archived on reassignment — are **preserved untouched**, never dropped.

**New-field propagation:** adding a new org `FieldDefinition` auto-appears on every `AllActiveFields` type immediately (backward-compatible), and appears on `Curated` types only when an admin adds it there. This is intentional per-type control; surfaced in the admin UI so it isn't a silent surprise (see Open Questions).

---

## Application Layer

### `IIdeaTypeService` (extend the existing Idea Type admin surface)

Admin-only (`EnsureAdminScope`, matching `FieldDefinitionService`). The existing type CRUD/reorder gains:

| Operation | Purpose |
|---|---|
| Set appearance | Set/clear `ColorHex` + `Icon`. |
| Set field selection | Replace the type's `IdeaTypeField` links (ids + per-link order + required); sets `FieldMode = Curated`. |
| Clear field selection | Empty the links; sets `FieldMode = AllActiveFields`. |
| Reassign idea type (admin) | Change a single idea's `IdeaTypeId`; re-resolve, archive out-of-scope values, emit audit. |

Validation rules:
- Every `fieldDefinitionId` in a selection must be an **active** field definition in the same org (else `400`).
- No duplicate field in a type's selection.
- `ColorHex` must be `#RRGGBB` if present; contrast is advisory (mirror the status picker's warning), not blocking.
- Reassign target must be an active idea type in the same org (else `400`); actor must be OrgAdmin (own org) or SiteAdmin.

### `IdeaService` changes

- **Create:** `CreateIdeaCommand` already carries `IdeaTypeId` (no signature change). Resolve effective fields for that type and validate submitted values against the **resolved** set instead of the full active-definition list.
- **Validator:** `FieldValueValidator.Validate(...)` takes the **resolved effective fields** (each carrying its effective `IsRequired`). A submitted value for a field outside the resolved set → `"<fieldName>" is not a field for this idea type.` (`400`).
- **Update:** enforce immutability — reject an update whose `ideaTypeId` differs from stored (`400`), or drop `ideaTypeId` from the update contract entirely. Field values reconcile against the type's resolved set as the scope. A `null` `FieldValues` still means "leave values untouched."
- **Late-required enforcement:** marking a mapped field required does **not** retroactively invalidate existing ideas; the requirement is enforced on new ideas and on the next edit of an existing one (no backfill — matches the UDF spec's stance).
- **Detail projection:** order and label field values by the resolved set; historical values for fields no longer resolved (removed from a `Curated` type, or archived on reassignment) render with the existing "archived value" treatment — preserved, shown muted, never dropped.

---

## API Endpoints

All under `/api/v1`, org-scoped, admin-only for management (mirroring `field-definitions` / `idea-types`).

### Idea Type field selection + appearance (Admin only)

| Method | Route | Description |
|---|---|---|
| `PUT` | `/organizations/{orgId}/idea-types/{id}/fields` | Replace the type's field selection (ids + order + required); switches it to `Curated`. Empty body/list clears → `AllActiveFields`. |
| `PUT` | `/organizations/{orgId}/idea-types/{id}/appearance` | Set/clear `colorHex` + `icon`. |

(Existing `idea-types` list/create/update/reorder/soft-delete routes are unchanged.)

### Idea reassignment (Admin only, P1)

| Method | Route | Description |
|---|---|---|
| `PUT` | `/organizations/{orgId}/ideas/{ideaId}/idea-type` | Reassign the idea's type. Body `{ "ideaTypeId": "<guid>" }`. Re-resolves fields; out-of-scope values archived; audit emitted. |

### Idea payloads

`CreateIdeaRequest` already includes required `ideaTypeId` (unchanged). Embedded `fieldValues` shape unchanged. `IdeaDetailModel` already returns `fieldValues`, now ordered/filtered by the resolved set, plus the type's `colorHex`/`icon` for the badge. The idea **update** contract must not change `ideaTypeId`.

---

## Client UI

Design locked in `SPEC/mockups/comp-c-review-09-idea-type-fields.html` (built on the locked v5 system).

### Admin: Idea Types (Settings)

- **List** (`/organizations/{orgId}/settings/idea-types`): rows show the **type badge** (color + icon + name), a **"fields on this type"** count + preview, idea count, and state. Reorder by drag. Last-type Archive disabled with tooltip.
- **Editor:** name; **color picker + icon picker** (reuse the status color picker, incl. the contrast warning); live **badge preview**; and a **two-pane field picker** (available org fields → fields on this type) with drag-order and a per-field **Required** toggle. Choosing fields switches the type to `Curated`; "clear all" returns it to `AllActiveFields (all fields)`.

### Idea form

- The **Idea Type** selector is required and appears near the top of the create form (it drives everything below). Switching it reflows the Custom Fields section live.
- The Custom Fields section renders the **resolved** fields for the selected type, in order, with per-type required markers.

### Idea detail / edit

- Type shown **read-only** as a badge (immutable). An admin-only **"Reassign type…"** control opens an inline confirm that names which current values would be archived; the change is logged.
- Historical out-of-type values render muted with an "archived" tag, consistent with soft-deleted UDFs.

### Type badge placement (open)

On swimlane/list cards the badge shares space with the priority chip and status dot — placement TBD to avoid chip overload (see Open Questions #10).

---

## Permissions

| Role | Manage type fields / appearance | Reassign idea type | Pick type + fill fields | View idea fields |
|---|---|---|---|---|
| `SiteAdmin` | ✅ | ✅ | ✅ | ✅ |
| `OrgAdmin` | ✅ (own org) | ✅ (own org) | ✅ | ✅ |
| `User` | ❌ | ❌ | ✅ | ✅ |
| `ReadOnly` | ❌ | ❌ | ❌ | ✅ |

---

## Requirements

### Must-Have (P0)

- **[P0] Idea type immutability.** `Idea.IdeaTypeId` already exists/required; make it immutable after creation — remove type from the edit path (or reject a differing `ideaTypeId` on update with `400`). `BusinessImpactId` unchanged.
- **[P0] `IdeaTypeField` mapping.** Admins map a subset of active org UDFs onto a type, each with per-type order and required flag. Field appears at most once per type; every referenced field is active and in-org (`400` otherwise).
- **[P0] Field mode.** `AllActiveFields` (default) vs `Curated`. Adding a field selection sets `Curated`; clearing returns to `AllActiveFields`.
- **[P0] Effective-field resolution.** Forms, validator, and detail all use the resolution algorithm and required-ness table above.
- **[P0] Required-ness override.** `IdeaTypeField.IsRequired` governs `Curated` types; `FieldDefinition.IsRequired` governs `AllActiveFields` types and seeds a newly-mapped field's required flag.
- **[P0] Value scoping.** Submitting a value for a field outside the idea's resolved set → `400`. Empty required fields block save.
- **[P0] Type appearance.** `IdeaType` carries optional `ColorHex` + `Icon`, surfaced as a badge on list/cards/detail; nullable with a neutral fallback.
- **[P0] Backward compatibility.** Un-curated types and existing ideas behave exactly as today.
- **[P0] No orphaning / no loss.** Values for fields removed from a `Curated` type — or archived on reassignment — are preserved and shown archived.

### Nice-to-Have (P1)

- **[P1] Admin reassign idea type.** Guarded endpoint + inline UI; re-resolves fields, archives out-of-scope values, emits `IdeaTypeReassigned` audit.
- **[P1] "Fields on this type" count** and used-by-N-ideas surfaced in the admin list.
- **[P1] Copy fields from another type** to speed up curating a similar type.

### Future Considerations (P2)

- **[P2] Fully relocate required-ness** (drop the global `FieldDefinition.IsRequired`) once all types are `Curated`.
- **[P2] Default values / scaffolding per type** (the original "template" reading).
- **[P2] Per-type field snapshots** so an idea can render against the type as it was at creation.

---

## Migration Strategy

**EF migration `AddIdeaTypeFields`:**
- New table `idea_type_fields` (snake_case): `(idea_type_id, field_definition_id, display_order, is_required)`, unique `(idea_type_id, field_definition_id)`, FK to `idea_types` and `field_definitions`.
- `idea_types` gains `color_hex` (nullable), `icon` (nullable), `field_mode` (int, default `0 = AllActiveFields`).
- **No `ideas` change** — `idea_type_id` already exists and is backfilled.
- **Backward-compat backfill:** existing types default to `field_mode = AllActiveFields`, so every idea resolves to "all active fields" — identical to current behavior. No `idea_type_fields` rows are seeded; admins opt into curation per type.
- Touches only new/changed tables, so it should merge cleanly against `CollegaDbContextModelSnapshot` provided no other in-flight slice adds a migration concurrently.

---

## Impact on Existing Specs

Per repo working rules, make these canonical edits **before implementation**:

1. **`SPEC/20-feature-user-defined-fields.md`** — reinterpret the *"Template Integration — Forward Compatibility"* section: v1 templates are per-type field **selections** (direct mapping), not default-value injectors; defaults move to P2. Update the required-fields row to note the per-type override + `AllActiveFields` default.
2. **`SPEC/20-feature-ideas-and-engagement.md`** — record that idea type is **immutable after creation** (currently editable via update), with an admin-only reassign exception; cross-reference this spec for per-type field resolution; note the new `ColorHex`/`Icon` on `IdeaType`.
3. **`SPEC/30-Contracts.md`** — add `idea-types/{id}/fields`, `idea-types/{id}/appearance`, and `ideas/{id}/idea-type` (reassign) routes; note the update contract must not change `ideaTypeId`.

---

## Open Questions

- **[Product]** New-field propagation to `Curated` types is manual by design. Confirm the admin UI surfaces "N types don't include this new field" prominently enough. — non-blocking.
- **[Product]** Admin reassign is P1. Confirm it isn't needed for MVP launch (immutability alone ships as P0). — non-blocking.
- **[Design]** Type badge placement on cards vs the priority chip + status dot (chip overload). — resolve in the card comp before Client work.
- **[Eng]** Should the global `FieldDefinition.IsRequired` be dropped eventually or kept as the `AllActiveFields` default? (P2 decides; v1 keeps it.) — non-blocking.

---

## Effort Sizing (backend-first; Client is a later wave per repo convention)

| Layer | Work | Estimate |
|---|---|---|
| **Domain** | `IdeaTypeField`, `IdeaType` appearance + `FieldMode` + selection methods, **idea-type immutability** (remove from `UpdateContent`), resolution helper | S–M — 1–1.5 days |
| **Infrastructure / EF** | `IdeaTypeField` config, `idea_types` column adds, `AddIdeaTypeFields` migration (no idea backfill) | S–M — 1 day |
| **Application** | Type field-selection + appearance ops, resolution algorithm, `FieldValueValidator` signature change, `IdeaService` create/validate/detail wiring, reject type change on update | M — 2–3 days |
| **Application (P1)** | Admin reassign op + `IdeaTypeReassigned` audit | S — 0.5–1 day |
| **API** | `idea-types/{id}/fields` + `/appearance` routes, reassign route (P1), contracts | S–M — 1–1.5 days |
| **Tests** | Resolution (AllActiveFields/Curated/archived), per-type required override, immutability rejection, out-of-set value rejection, appearance, reassign archiving | M — 2 days |
| **Client (later wave)** | Idea Types editor (color/icon + two-pane field picker), type badge, idea-form resolved fields, read-only type + reassign on detail | M–L — 4–5 days |
| **Backend total (P0)** | | **~6–8 dev-days** |
