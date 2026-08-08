using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Collega.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantAdministration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "address",
                table: "organizations",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "organizations",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "organizations",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "logo_height_px",
                table: "organizations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "logo_thumbnail_url",
                table: "organizations",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "logo_url",
                table: "organizations",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "organizations",
                type: "nvarchar(25)",
                maxLength: 25,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "primary_contact_first_name",
                table: "organizations",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "primary_contact_last_name",
                table: "organizations",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "state",
                table: "organizations",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "zip",
                table: "organizations",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "boards",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organization_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    allow_user_status_update = table.Column<bool>(type: "bit", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_boards", x => x.id);
                    table.ForeignKey(
                        name: "FK_boards_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "statuses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organization_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_statuses", x => x.id);
                    table.ForeignKey(
                        name: "FK_statuses_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "board_swimlanes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    board_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_board_swimlanes", x => x.id);
                    table.ForeignKey(
                        name: "FK_board_swimlanes_boards_board_id",
                        column: x => x.board_id,
                        principalTable: "boards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_board_swimlanes_statuses_status_id",
                        column: x => x.status_id,
                        principalTable: "statuses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_board_swimlanes_status_id",
                table: "board_swimlanes",
                column: "status_id");

            migrationBuilder.CreateIndex(
                name: "ux_board_swimlanes_board_id_status_id",
                table: "board_swimlanes",
                columns: new[] { "board_id", "status_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_boards_organization_id",
                table: "boards",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_statuses_organization_id_sort_order",
                table: "statuses",
                columns: new[] { "organization_id", "sort_order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "board_swimlanes");

            migrationBuilder.DropTable(
                name: "boards");

            migrationBuilder.DropTable(
                name: "statuses");

            migrationBuilder.DropColumn(
                name: "address",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "city",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "description",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "logo_height_px",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "logo_thumbnail_url",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "logo_url",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "primary_contact_first_name",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "primary_contact_last_name",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "state",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "zip",
                table: "organizations");
        }
    }
}
