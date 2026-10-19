using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ledger.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SiteSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PageTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    HeaderText = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    HeroTitle = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    HeroDescription = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    FooterText = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SiteSettings");
        }
    }
}
