"use client";

/**
 * User-defined fields, at `/settings/fields` and
 * `/settings/organizations/{orgId}/fields`.
 *
 * The organization's catalogue of custom fields. Defining one here makes it available to
 * idea types; nothing appears on an idea until a type picks it up.
 *
 * **A real difference worth resolving before Nest.** This list reorders with paired arrow
 * buttons in the action cell, while statuses and idea types reorder by drag — a difference
 * inherited from `FieldDefinitionsAdmin.razor` and kept here because these screens are a port
 * of what the product does, not a proposal to change it. Comp P flags it as unresolved and so
 * does this.
 *
 * **What the corpus can show.** The recorded catalogue is one field, and only as an Org
 * Admin: a Site Admin, a member and a read-only account all get an empty array from the same
 * endpoint. So the empty state below is what most roles actually see, and it is real.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableCell,
  TableRow,
  Textarea,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { useApi } from "@/lib/api";
import type { Role } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import {
  Cols,
  Guarded,
  ReadOnlyAside,
  SubmitOutcome,
  SubstitutionNote,
} from "@/app/(desk)/settings/_components/chrome";
import {
  NarrowedNote,
  SearchField,
  useListFrame,
} from "@/app/(desk)/settings/_components/list-frame";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { mayMutate } from "@/app/(desk)/settings/_lib/rules";
import type { FieldDefinition } from "@/app/(desk)/settings/_lib/types";

const FIELD_TYPES = ["Text", "Number", "Date", "Boolean", "Dropdown", "MultiSelect", "Url"];

function matches(field: FieldDefinition, needle: string): boolean {
  return (
    field.name.toLowerCase().includes(needle) || field.fieldType.toLowerCase().includes(needle)
  );
}

export function FieldsScreen({
  role,
  organizationId,
  organizationName,
  override,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  override: "empty" | "loading" | "error" | null;
}) {
  const mutable = mayMutate(role, "org-content");
  const fields = useApi<FieldDefinition[]>(
    organizationId ? `/organizations/${organizationId}/field-definitions` : null,
  );
  const create = useSubmit<FieldDefinition>();

  const [name, setName] = React.useState("");
  const [fieldType, setFieldType] = React.useState("Text");
  const [options, setOptions] = React.useState("");
  const [required, setRequired] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(true);

  const items = React.useMemo(
    () => [...(fields.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [fields.data],
  );
  const byArchived = React.useCallback(
    (field: FieldDefinition) => showArchived || !field.isDeleted,
    [showArchived],
  );

  const frame = useListFrame({
    items,
    filter: byArchived,
    loading: fields.state === "loading",
    error: fields.state === "error",
    matches,
    override,
  });

  const takesOptions = fieldType === "Dropdown" || fieldType === "MultiSelect";

  return (
    <>
      <SubstitutionNote mock={fields.mock} what="field definitions" className="mb-4" />

      <SearchField
        id="settings-fields-search"
        placeholder="Search fields…"
        value={frame.search}
        onChange={frame.setSearch}
      >
        <label className="flex h-9 items-center gap-2 text-sm" htmlFor="settings-fields-archived">
          <Checkbox
            id="settings-fields-archived"
            checked={showArchived}
            onCheckedChange={(value) => setShowArchived(value === true)}
          />
          Show archived
        </label>
      </SearchField>

      {frame.narrowed ? (
        <NarrowedNote shown={frame.visible.length} total={items.length} noun="fields" className="mb-4" />
      ) : null}

      <Cols
        aside={
          mutable ? (
            <Card>
              <CardContent>
                <h2 className="m-0 mb-4 text-lg font-semibold tracking-tight">Add field</h2>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!organizationId) return;
                    void create.send("POST", `/organizations/${organizationId}/field-definitions`, {
                      name,
                      fieldType,
                      isRequired: required,
                      options: takesOptions
                        ? options.split("\n").map((line) => line.trim()).filter(Boolean)
                        : [],
                    });
                  }}
                >
                  <div>
                    <Label htmlFor="settings-field-name">
                      Label <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="settings-field-name"
                      required
                      value={name}
                      aria-describedby="settings-field-name-hint"
                      onChange={(event) => setName(event.target.value)}
                    />
                    <p id="settings-field-name-hint" className="mt-1 mb-0 text-xs text-muted-foreground">
                      What the person filling in an idea sees beside the input.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="settings-field-type">Type</Label>
                    <Select value={fieldType} onValueChange={setFieldType}>
                      <SelectTrigger id="settings-field-type" aria-describedby="settings-field-type-hint">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p id="settings-field-type-hint" className="mt-1 mb-0 text-xs text-muted-foreground">
                      Type is fixed once ideas hold values for the field.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="settings-field-options">Options</Label>
                    <Textarea
                      id="settings-field-options"
                      rows={3}
                      placeholder="One per line"
                      value={options}
                      disabled={!takesOptions}
                      aria-describedby="settings-field-options-hint"
                      onChange={(event) => setOptions(event.target.value)}
                    />
                    <p
                      id="settings-field-options-hint"
                      className="mt-1 mb-0 text-xs text-muted-foreground"
                    >
                      Dropdown and multi-select only.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm" htmlFor="settings-field-required">
                    <Checkbox
                      id="settings-field-required"
                      checked={required}
                      onCheckedChange={(value) => setRequired(value === true)}
                    />
                    Required on every idea that shows it
                  </label>

                  <Button type="submit" disabled={create.state === "sending"}>
                    Add field
                  </Button>
                </form>
                <SubmitOutcome outcome={create} what="create" className="mt-4" />
              </CardContent>
            </Card>
          ) : (
            <ReadOnlyAside
              subject="fields"
              probe={
                organizationId
                  ? {
                      method: "POST",
                      path: `/organizations/${organizationId}/field-definitions`,
                      body: { name: "Probe", fieldType: "Text", isRequired: false },
                    }
                  : undefined
              }
            />
          )
        }
      >
        <AdminTable
          testId="settings-fields"
          state={frame.state}
          what="fields"
          error={fields.error}
          onRetry={fields.reload}
          columns={[
            { label: "Field" },
            { label: "Type", className: "w-32" },
            { label: "Required", className: "hidden w-24 sm:table-cell" },
            { label: "Options", className: "hidden w-56 lg:table-cell" },
            { label: "Actions", className: "w-40 text-right", actions: true },
          ]}
          foot={
            mutable
              ? "Reorder with the arrows — the order here is the order fields appear on an idea. Archived fields stay on ideas that already use them."
              : `Read-only. A Site Admin can read every organization’s fields and change none of them. Use View As to act as a member of ${organizationName}.`
          }
          emptyTitle={
            frame.narrowed
              ? "No fields match that filter"
              : mutable
                ? "No custom fields yet"
                : "This organization has no custom fields"
          }
          emptyDescription={
            frame.narrowed ? (
              "Try a shorter search, or show archived fields."
            ) : mutable ? (
              <>
                Fields you define here become available to idea types, which choose the subset
                their ideas show. Nothing appears on an idea until a type picks it up.
              </>
            ) : (
              <>
                Its ideas carry only the built-in fields. An administrator of this organization
                can add more.
              </>
            )
          }
        >
          {frame.visible.map((field, index) => (
            <TableRow key={field.fieldDefinitionId}>
              <TableCell className="font-medium text-foreground">
                {field.name}
                {field.isDeleted ? (
                  <Badge variant="outline" className="ml-2">
                    Archived
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>{field.fieldType}</TableCell>
              <TableCell className="hidden sm:table-cell">
                {field.isRequired ? "Yes" : <span className="text-muted-foreground">No</span>}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {field.options.length > 0 ? field.options.join(", ") : "—"}
              </TableCell>
              <RowActions>
                <Guarded role={role} scope="org-content" quiet>
                  {(denied) => (
                    <>
                      {/* An arrow at the end of the list is refused, not dropped, and says
                          why — so a keyboard user who lands on a dead control learns it is
                          dead by position rather than broken. When the whole row is refused
                          the role's reason takes precedence over the position's. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${field.name} up`}
                        {...(denied ??
                          (index === 0
                            ? { "aria-disabled": true, "aria-describedby": "settings-fields-first" }
                            : {}))}
                      >
                        <span aria-hidden="true">↑</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${field.name} down`}
                        {...(denied ??
                          (index === frame.visible.length - 1
                            ? { "aria-disabled": true, "aria-describedby": "settings-fields-last" }
                            : {}))}
                      >
                        <span aria-hidden="true">↓</span>
                      </Button>
                      <Button variant="ghost" size="sm" {...(denied ?? {})}>
                        Edit<span className="sr-only"> {field.name}</span>
                      </Button>
                    </>
                  )}
                </Guarded>
              </RowActions>
            </TableRow>
          ))}
        </AdminTable>

        {/* Visually hidden, unlike the read-only sentence in the footer: a greyed arrow at
            the top of a list is self-explanatory to anyone who can see where it sits. */}
        <span id="settings-fields-first" className="sr-only">
          Already first in the order.
        </span>
        <span id="settings-fields-last" className="sr-only">
          Already last in the order.
        </span>

        {mutable ? (
          <CorpusNote className="mt-4">
            reordering, editing and archiving are recorded as endpoints but the corpus holds no
            before-and-after pair for them, so the arrows above move nothing yet. The list is
            the recording, and it does not change.
          </CorpusNote>
        ) : null}
      </Cols>
    </>
  );
}
