namespace Ledger.Api.Models;

public class ProductTag
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }

    public required string Name { get; set; }

    public required string NormalizedName { get; set; }

    public Product Product { get; set; } = null!;
}
