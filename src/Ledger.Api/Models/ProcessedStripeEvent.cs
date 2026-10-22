namespace Ledger.Api.Models;

public class ProcessedStripeEvent
{
    public string EventId { get; set; } = "";

    public string Type { get; set; } = "";

    public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;
}
