using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Collega.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiUsageRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_usage_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    on_behalf_of_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    board_id = table.Column<Guid>(type: "uuid", nullable: true),
                    occurred_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    input_tokens = table.Column<int>(type: "integer", nullable: false),
                    output_tokens = table.Column<int>(type: "integer", nullable: false),
                    cache_read_input_tokens = table.Column<int>(type: "integer", nullable: false),
                    cache_creation_input_tokens = table.Column<int>(type: "integer", nullable: false),
                    input_rate_per_million = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false),
                    output_rate_per_million = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false),
                    key_source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_usage_records", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_records_occurred_at_utc",
                table: "ai_usage_records",
                column: "occurred_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_records_organization_id_occurred_at_utc",
                table: "ai_usage_records",
                columns: new[] { "organization_id", "occurred_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_usage_records");
        }
    }
}
