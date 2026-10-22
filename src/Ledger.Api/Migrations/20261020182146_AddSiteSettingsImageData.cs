using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ledger.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteSettingsImageData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FaviconContentType",
                table: "SiteSettings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "FaviconData",
                table: "SiteSettings",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FaviconUrl",
                table: "SiteSettings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoContentType",
                table: "SiteSettings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "LogoData",
                table: "SiteSettings",
                type: "bytea",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FaviconContentType",
                table: "SiteSettings");

            migrationBuilder.DropColumn(
                name: "FaviconData",
                table: "SiteSettings");

            migrationBuilder.DropColumn(
                name: "FaviconUrl",
                table: "SiteSettings");

            migrationBuilder.DropColumn(
                name: "LogoContentType",
                table: "SiteSettings");

            migrationBuilder.DropColumn(
                name: "LogoData",
                table: "SiteSettings");
        }
    }
}
