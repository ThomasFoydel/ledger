namespace Ledger.Api.Models;

public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Status { get; set; } = "Pending";
    public string FulfillmentStatus { get; set; } = "Unfulfilled";
    public string Currency { get; set; } = "usd";
    public decimal SubtotalAmount { get; set; }
    public decimal ShippingAmount { get; set; }
    public decimal TotalAmount { get; set; }

    public string? ShippingServiceToken { get; set; }
    public string? ShippingServiceName { get; set; }
    public string? ShippingProvider { get; set; }

    public string? ShippingName { get; set; }
    public string? ShippingStreet1 { get; set; }
    public string? ShippingStreet2 { get; set; }
    public string? ShippingCity { get; set; }
    public string? ShippingState { get; set; }
    public string? ShippingPostalCode { get; set; }
    public string? ShippingCountry { get; set; }

    public string? ShippingRateIdsJson { get; set; }

    public string? StripeCheckoutSessionId { get; set; }
    public string? CustomerEmail { get; set; }
    public string? UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAtUtc { get; set; }

    public List<OrderItem> Items { get; set; } = [];
    public List<OrderShipment> Shipments { get; set; } = [];
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

public class OrderShipment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int ParcelNumber { get; set; }

    public string? ShippingRateId { get; set; }
    public string? Carrier { get; set; }
    public string? ServiceName { get; set; }
    public decimal ShippingAmount { get; set; }

    public string Status { get; set; } = "Pending";
    public string? TrackingNumber { get; set; }
    public string? TrackingUrl { get; set; }

    public DateTime? ShippedAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
}
