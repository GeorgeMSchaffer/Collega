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
