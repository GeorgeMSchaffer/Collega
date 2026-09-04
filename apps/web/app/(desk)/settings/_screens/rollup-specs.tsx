"use client";

/**
 * What each cross-organization roll-up puts in its one detail column.
 *
 * Kept together so the four Site-Admin screens are visibly the same screen over different
 * data, and so the detail column of each is one place to look at when the payload changes.
 */

import { Badge } from "@collega/design-system";

import { Marker } from "@/components/desk/marker";
import { ROLE_LABELS } from "@/lib/format";
import type { Paged, Status } from "@/lib/types";

import type { RollupSpec } from "@/app/(desk)/settings/_screens/rollup-screen";
import type { FieldDefinition, IdeaTypeAdmin, OrgUser } from "@/app/(desk)/settings/_lib/types";

export const STATUSES_ROLLUP: RollupSpec<Status[]> = {
  noun: "statuses",
  one: "status",
  detailLabel: "Colour",
  path: (id) => `/organizations/${id}/statuses`,
  target: (id) => `/settings/organizations/${id}/statuses`,
  rowsOf: (statuses, organization) =>
    [...statuses]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((status) => ({
        key: status.statusId,
        name: status.name,
        // The name beside the swatch, never the swatch alone.
        detail: <Marker color={status.color}>{status.color ?? "No colour"}</Marker>,
        organizationId: organization.organizationId,
        organizationTitle: organization.title,
      })),
};

export const IDEA_TYPES_ROLLUP: RollupSpec<IdeaTypeAdmin[]> = {
  noun: "idea types",
  one: "idea type",
  detailLabel: "Fields on this type",
  path: (id) => `/organizations/${id}/idea-types`,
  target: (id) => `/settings/organizations/${id}/idea-types`,
  rowsOf: (types, organization) =>
    [...types]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((type) => ({
        key: type.ideaTypeId,
        name: type.name,
        detail:
          type.fieldMode === "AllActiveFields"
            ? "Every active field"
            : `${type.fields.length} chosen`,
        organizationId: organization.organizationId,
        organizationTitle: organization.title,
      })),
};

export const FIELDS_ROLLUP: RollupSpec<FieldDefinition[]> = {
  noun: "fields",
  one: "field",
  detailLabel: "Type",
  path: (id) => `/organizations/${id}/field-definitions`,
  target: (id) => `/settings/organizations/${id}/fields`,
  rowsOf: (fields, organization) =>
    [...fields]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((field) => ({
        key: field.fieldDefinitionId,
        name: field.name,
        detail: field.fieldType,
        organizationId: organization.organizationId,
        organizationTitle: organization.title,
      })),
};

export const USERS_ROLLUP: RollupSpec<Paged<OrgUser>> = {
  noun: "users",
  one: "user",
  detailLabel: "Role",
  action: "Details",
  path: (id) => `/organizations/${id}/users`,
  target: (id) => `/settings/organizations/${id}/users`,
  rowsOf: (page, organization) =>
    page.items.map((user) => ({
      key: user.userId,
      name: `${user.firstName} ${user.lastName}`,
      detail: <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>,
      organizationId: organization.organizationId,
      organizationTitle: organization.title,
      // The action announces this person, so it opens their panel rather than dropping the
      // viewer at the top of the organization's list to find them again.
      href: `/settings/organizations/${organization.organizationId}/users?user=${user.userId}`,
    })),
};
