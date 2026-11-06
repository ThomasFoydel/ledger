using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace Ledger.Api.Endpoints;

public static class StripeWebhookEndpoints
{
    public static IEndpointRouteBuilder MapStripeWebhookEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPost("/stripe/webhook", async (
            HttpRequest request,
            LedgerDbContext db,
            IConfiguration configuration,
            CancellationToken ct) =>
        {
            var json = await new StreamReader(request.Body).ReadToEndAsync(ct);
            var signature = request.Headers["Stripe-Signature"].ToString();
            var webhookSecret = configuration["Stripe:WebhookSecret"];

            if (string.IsNullOrWhiteSpace(webhookSecret))
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Stripe webhook is not configured.");

            Event stripeEvent;

            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    signature,
                    webhookSecret);
            }
            catch (Exception)
            {
                return Results.BadRequest();
            }

            if (stripeEvent.Type is not "checkout.session.completed"
                and not "checkout.session.expired")
            {
                return Results.Ok();
            }

            var stripeSession = stripeEvent.Data.Object as Session;

            if (stripeSession is null ||
                !Guid.TryParse(
                    stripeSession.Metadata.GetValueOrDefault("orderId"),
                    out var orderId))
            {
                return Results.Ok();
            }

            await using var transaction =
                await db.Database.BeginTransactionAsync(ct);

            var alreadyProcessed = await db.ProcessedStripeEvents
                .AnyAsync(item => item.EventId == stripeEvent.Id, ct);

            if (alreadyProcessed)
                return Results.Ok();

            var order = await db.Orders
                .Include(order => order.Items)
                .FirstOrDefaultAsync(order => order.Id == orderId, ct);

            if (order is null)
                return Results.Ok();

            if (stripeEvent.Type == "checkout.session.expired")
            {
                if (order.Status == "Pending")
                    order.Status = "Expired";
            }
            else if (stripeEvent.Type == "checkout.session.completed")
            {
                if (order.Status == "Pending")
                {
                    var quantities = order.Items
                        .GroupBy(item => item.ProductId)
                        .ToDictionary(
                            group => group.Key,
                            group => group.Sum(item => item.Quantity));

                    var products = await db.Products
                        .Where(product => quantities.Keys.Contains(product.Id))
                        .ToListAsync(ct);

                    var inventoryAvailable = products.Count == quantities.Count &&
                        products.All(product =>
                            product.QuantityOnHand >= quantities[product.Id]);

                    if (inventoryAvailable)
                    {
                        foreach (var product in products)
                            product.QuantityOnHand -= quantities[product.Id];

                        order.Status = "Paid";
                    }
                    else
                    {
                        order.Status = "PaidInventoryIssue";
                    }

                    order.PaidAtUtc = DateTime.UtcNow;
                    order.CustomerEmail = stripeSession.CustomerDetails?.Email;
                }
            }

            db.ProcessedStripeEvents.Add(new ProcessedStripeEvent
            {
                EventId = stripeEvent.Id,
                Type = stripeEvent.Type
            });

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Results.Ok();
        })
        .WithName("StripeWebhook");

        return app;
    }
}
