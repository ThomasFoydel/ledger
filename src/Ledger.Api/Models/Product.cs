namespace Ledger.Api.Models;

public class Product
{
  public Guid Id { get; set; } = Guid.NewGuid();

  public required string Name { get; set; }

  public string? Description { get; set; }

  public decimal Price { get; set; }

  public bool IsActive { get; set; } = true;

  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
