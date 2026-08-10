using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Collega.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIdeaTypeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "color_hex",
                table: "idea_types",
                type: "nvarchar(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "field_mode",
                table: "idea_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "icon",
                table: "idea_types",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "idea_type_fields",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    idea_type_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    field_definition_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idea_type_fields", x => x.id);
                    table.ForeignKey(
                        name: "FK_idea_type_fields_field_definitions_field_definition_id",
                        column: x => x.field_definition_id,
                        principalTable: "field_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_idea_type_fields_idea_types_idea_type_id",
                        column: x => x.idea_type_id,
                        principalTable: "idea_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_idea_type_fields_field_definition_id",
                table: "idea_type_fields",
                column: "field_definition_id");

            migrationBuilder.CreateIndex(
                name: "ux_idea_type_fields_idea_type_id_field_definition_id",
                table: "idea_type_fields",
                columns: new[] { "idea_type_id", "field_definition_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "idea_type_fields");

            migrationBuilder.DropColumn(
                name: "color_hex",
                table: "idea_types");

            migrationBuilder.DropColumn(
                name: "field_mode",
                table: "idea_types");

            migrationBuilder.DropColumn(
                name: "icon",
                table: "idea_types");
        }
    }
}
