namespace Ledger.Api.Models;

public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Status { get; set; } = "Pending";
    public string Currency { get; set; } = "usd";
    public decimal TotalAmount { get; set; }
    public string? StripeCheckoutSessionId { get; set; }
    public string? CustomerEmail { get; set; }
    public string? UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAtUtc { get; set; }
    public List<OrderItem> Items { get; set; } = [];
}

public class OrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}
