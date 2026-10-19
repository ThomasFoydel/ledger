using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ledger.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProductInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "QuantityOnHand",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_QuantityOnHand_NonNegative",
                table: "Products",
                sql: "\"QuantityOnHand\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_QuantityOnHand_NonNegative",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "QuantityOnHand",
                table: "Products");
        }
    }
}
