-- ---------------------------------------------------------------------------
-- Fieldsets (SPEC/decisions.md 2026-10-04, the sixth amendment to the S0.2
-- schema freeze; SPEC/20-feature-idea-type-fields.md, SPEC/contracts/fieldsets.md).
--
-- A fieldset is a named, ordered group of an organization's field definitions;
-- an idea type attaches fieldsets as live references. Additive: three new
-- tables, no change to an existing one, no backfill.
--
-- Deleting a fieldset cascades its membership, but is refused while an idea
-- type still has it attached (no action from idea_type_fieldsets).
-- ---------------------------------------------------------------------------
-- CreateTable
CREATE TABLE "fieldsets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "display_order" INTEGER NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_fieldsets" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fieldset_fields" (
    "id" UUID NOT NULL,
    "fieldset_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "PK_fieldset_fields" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_type_fieldsets" (
    "id" UUID NOT NULL,
    "idea_type_id" UUID NOT NULL,
    "fieldset_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "PK_idea_type_fieldsets" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_fieldsets_organization_id_display_order" ON "fieldsets"("organization_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "ux_fieldsets_organization_id_normalized_name" ON "fieldsets"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "IX_fieldset_fields_field_definition_id" ON "fieldset_fields"("field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_fieldset_fields_fieldset_id_field_definition_id" ON "fieldset_fields"("fieldset_id", "field_definition_id");

-- CreateIndex
CREATE INDEX "IX_idea_type_fieldsets_fieldset_id" ON "idea_type_fieldsets"("fieldset_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_type_fieldsets_idea_type_id_fieldset_id" ON "idea_type_fieldsets"("idea_type_id", "fieldset_id");

-- AddForeignKey
ALTER TABLE "fieldsets" ADD CONSTRAINT "FK_fieldsets_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fieldset_fields" ADD CONSTRAINT "FK_fieldset_fields_field_definitions_field_definition_id" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fieldset_fields" ADD CONSTRAINT "FK_fieldset_fields_fieldsets_fieldset_id" FOREIGN KEY ("fieldset_id") REFERENCES "fieldsets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_type_fieldsets" ADD CONSTRAINT "FK_idea_type_fieldsets_fieldsets_fieldset_id" FOREIGN KEY ("fieldset_id") REFERENCES "fieldsets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_type_fieldsets" ADD CONSTRAINT "FK_idea_type_fieldsets_idea_types_idea_type_id" FOREIGN KEY ("idea_type_id") REFERENCES "idea_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

