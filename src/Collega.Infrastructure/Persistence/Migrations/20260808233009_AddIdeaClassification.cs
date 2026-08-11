using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Collega.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIdeaClassification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "business_impact_id",
                table: "ideas",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "idea_type_id",
                table: "ideas",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Backfill: the two columns above were added to existing rows with an all-zero default
            // Guid that satisfies no foreign key. Before the FKs are created, provision the canonical
            // default option sets (OrganizationDefaults) for any organization that already has ideas
            // but no active Business Impact / Idea Type options, then point every pre-existing idea at
            // its organization's default (lowest sort_order, non-deleted) option. Without this, applying
            // this migration over a database that already contains idea rows fails on
            // FK_ideas_business_impacts_business_impact_id (and the idea_types FK). A fresh database has
            // no idea rows, so these statements are no-ops there.
            migrationBuilder.Sql(@"
INSERT INTO business_impacts (id, organization_id, name, color, sort_order, is_deleted, created_at_utc, updated_at_utc)
SELECT NEWID(), o.id, v.name, v.color, v.sort_order, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM organizations o
CROSS APPLY (VALUES
    (N'Low', N'#16A34A', 10),
    (N'Medium', N'#2563EB', 20),
    (N'High', N'#D97706', 30),
    (N'Critical', N'#DC2626', 40)
) AS v(name, color, sort_order)
WHERE EXISTS (SELECT 1 FROM ideas i WHERE i.organization_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM business_impacts b WHERE b.organization_id = o.id AND b.is_deleted = 0);");

            migrationBuilder.Sql(@"
INSERT INTO idea_types (id, organization_id, name, sort_order, is_deleted, created_at_utc, updated_at_utc)
SELECT NEWID(), o.id, v.name, v.sort_order, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM organizations o
CROSS APPLY (VALUES
    (N'Continuous Improvement', 10),
    (N'Process Revision', 20)
) AS v(name, sort_order)
WHERE EXISTS (SELECT 1 FROM ideas i WHERE i.organization_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM idea_types t WHERE t.organization_id = o.id AND t.is_deleted = 0);");

            migrationBuilder.Sql(@"
UPDATE i
SET i.business_impact_id = def.id
FROM ideas i
CROSS APPLY (
    SELECT TOP (1) b.id
    FROM business_impacts b
    WHERE b.organization_id = i.organization_id AND b.is_deleted = 0
    ORDER BY b.sort_order, b.id
) def
WHERE i.business_impact_id = '00000000-0000-0000-0000-000000000000';");

            migrationBuilder.Sql(@"
UPDATE i
SET i.idea_type_id = def.id
FROM ideas i
CROSS APPLY (
    SELECT TOP (1) t.id
    FROM idea_types t
    WHERE t.organization_id = i.organization_id AND t.is_deleted = 0
    ORDER BY t.sort_order, t.id
) def
WHERE i.idea_type_id = '00000000-0000-0000-0000-000000000000';");

            migrationBuilder.CreateIndex(
                name: "IX_ideas_business_impact_id",
                table: "ideas",
                column: "business_impact_id");

            migrationBuilder.CreateIndex(
                name: "IX_ideas_idea_type_id",
                table: "ideas",
                column: "idea_type_id");

            migrationBuilder.AddForeignKey(
                name: "FK_ideas_business_impacts_business_impact_id",
                table: "ideas",
                column: "business_impact_id",
                principalTable: "business_impacts",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ideas_idea_types_idea_type_id",
                table: "ideas",
                column: "idea_type_id",
                principalTable: "idea_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ideas_business_impacts_business_impact_id",
                table: "ideas");

            migrationBuilder.DropForeignKey(
                name: "FK_ideas_idea_types_idea_type_id",
                table: "ideas");

            migrationBuilder.DropIndex(
                name: "IX_ideas_business_impact_id",
                table: "ideas");

            migrationBuilder.DropIndex(
                name: "IX_ideas_idea_type_id",
                table: "ideas");

            migrationBuilder.DropColumn(
                name: "business_impact_id",
                table: "ideas");

            migrationBuilder.DropColumn(
                name: "idea_type_id",
                table: "ideas");
        }
    }
}
