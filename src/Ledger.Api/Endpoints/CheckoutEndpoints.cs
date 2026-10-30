using System.Security.Claims;
using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace Ledger.Api.Endpoints;

public static class CheckoutEndpoints
{
    public static IEndpointRouteBuilder MapCheckoutEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPost("/checkout/sessions", async (
            CheckoutRequest request,
            LedgerDbContext db,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            HttpContext context,
            CancellationToken ct) =>
        {
            var secretKey = configuration["Stripe:SecretKey"];
            var frontendBaseUrl = configuration["Frontend:BaseUrl"]
                ?? (environment.IsDevelopment() ? "http://localhost:5173" : null);

            if (string.IsNullOrWhiteSpace(secretKey) ||
                string.IsNullOrWhiteSpace(frontendBaseUrl) ||
                !Uri.TryCreate(frontendBaseUrl, UriKind.Absolute, out var frontendUri) ||
                (frontendUri.Scheme != Uri.UriSchemeHttps && !environment.IsDevelopment()))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Checkout is not configured.");
            }

            if (request.Items is null ||
                request.Items.Count is 0 or > 50 ||
                request.Items.Any(item =>
                    item.ProductId == Guid.Empty ||
                    item.Quantity is < 1 or > 100) ||
                request.Items.Select(item => item.ProductId).Distinct().Count()
                    != request.Items.Count)
            {
                return Results.BadRequest(new
                {
                    error = "Provide 1–50 distinct products with quantities between 1 and 100."
                });
            }

            var productIds = request.Items.Select(item => item.ProductId).ToArray();

            var products = await db.Products
                .Where(product => productIds.Contains(product.Id) && product.IsActive)
                .ToListAsync(ct);

            if (products.Count != productIds.Length)
            {
                return Results.BadRequest(new
                {
                    error = "One or more products are unavailable. Refresh your cart and try again."
                });
            }

            var productById = products.ToDictionary(product => product.Id);
            var orderItems = new List<OrderItem>();

            foreach (var item in request.Items)
            {
                var product = productById[item.ProductId];

                if (product.Price <= 0 || item.Quantity > product.QuantityOnHand)
                {
                    return Results.BadRequest(new
                    {
                        error = "A product is out of stock or has an invalid price. Refresh your cart and try again."
                    });
                }

                orderItems.Add(new OrderItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = item.Quantity
                });
            }

            var order = new Order
            {
                UserId = context.User.Identity?.IsAuthenticated == true
                    ? context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                    : null,
                Items = orderItems,
                TotalAmount = orderItems.Sum(item => item.UnitPrice * item.Quantity)
            };

            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);

            try
            {
                var stripe = new StripeClient(secretKey);
                var service = new SessionService(stripe);
                var baseUrl = frontendUri.ToString().TrimEnd('/');

                var options = new SessionCreateOptions
                {
                    Mode = "payment",
                    SuccessUrl = $"{baseUrl}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
                    CancelUrl = $"{baseUrl}/checkout/cancel",
                    ClientReferenceId = order.Id.ToString(),
                    Metadata = new Dictionary<string, string>
                    {
                        ["orderId"] = order.Id.ToString()
                    },
                    LineItems = orderItems.Select(item => new SessionLineItemOptions
                    {
                        Quantity = item.Quantity,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            UnitAmount = decimal.ToInt64(
                                decimal.Round(item.UnitPrice * 100m, 0)),
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = item.ProductName
                            }
                        }
                    }).ToList()
                };

                var session = await service.CreateAsync(
                    options,
                    new RequestOptions { IdempotencyKey = $"checkout-{order.Id}" },
                    ct);

                order.StripeCheckoutSessionId = session.Id;
                await db.SaveChangesAsync(ct);

                return Results.Ok(new
                {
                    sessionId = session.Id,
                    url = session.Url
                });
            }
            catch (StripeException)
            {
                order.Status = "CheckoutFailed";
                await db.SaveChangesAsync(ct);

                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Could not start secure checkout.",
                    detail: "Please try again.");
            }
        })
        .WithName("CreateCheckoutSession");

        app.MapGet("/checkout/sessions/{sessionId}", async (
            string sessionId,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var order = await db.Orders
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    item => item.StripeCheckoutSessionId == sessionId,
                    ct);

            return order is null
                ? Results.NotFound()
                : Results.Ok(new { orderId = order.Id, status = order.Status });
        })
        .WithName("GetCheckoutStatus");

        app.MapPost("/stripe/webhook", async (
            HttpRequest request,
            LedgerDbContext db,
            IConfiguration configuration,
            CancellationToken ct) =>
        {
            var webhookSecret = configuration["Stripe:WebhookSecret"];
            var signature = request.Headers["Stripe-Signature"].ToString();

            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Stripe webhook is not configured.");
            }

            if (string.IsNullOrWhiteSpace(signature))
                return Results.BadRequest();

            using var reader = new StreamReader(request.Body);
            var payload = await reader.ReadToEndAsync(ct);

            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    payload,
                    signature,
                    webhookSecret);
            }
            catch (StripeException)
            {
                return Results.BadRequest();
            }

            if (stripeEvent.Type is not "checkout.session.completed"
                and not "checkout.session.expired")
            {
                return Results.Ok();
            }

            if (await db.ProcessedStripeEvents.AnyAsync(
                item => item.EventId == stripeEvent.Id, ct))
            {
                return Results.Ok();
            }

            if (stripeEvent.Data.Object is not Session session)
                return Results.BadRequest();

            if (stripeEvent.Type == "checkout.session.completed" &&
                session.PaymentStatus != "paid")
            {
                return Results.Ok();
            }

            Guid.TryParse(
                session.Metadata?.GetValueOrDefault("orderId"),
                out var metadataOrderId);

            await using var transaction = db.Database.IsRelational()
                ? await db.Database.BeginTransactionAsync(ct)
                : null;

            var order = await db.Orders
                .Include(item => item.Items)
                .FirstOrDefaultAsync(
                    item => item.StripeCheckoutSessionId == session.Id ||
                            (metadataOrderId != Guid.Empty && item.Id == metadataOrderId),
                    ct);

            if (order is null)
                return Results.Ok();

            if (stripeEvent.Type == "checkout.session.expired")
            {
                if (order.Status == "Pending")
                    order.Status = "Cancelled";
            }
            else if (order.Status == "Pending")
            {
                var productIds = order.Items.Select(item => item.ProductId).ToArray();
                var currentProducts = await db.Products
                    .Where(product => productIds.Contains(product.Id))
                    .ToListAsync(ct);

                var productsById = currentProducts.ToDictionary(product => product.Id);

                var inventoryAvailable = order.Items.All(item =>
                    productsById.TryGetValue(item.ProductId, out var product) &&
                    product.IsActive &&
                    product.QuantityOnHand >= item.Quantity);

                order.CustomerEmail = session.CustomerDetails?.Email;
                order.PaidAtUtc = DateTime.UtcNow;

                if (inventoryAvailable)
                {
                    foreach (var item in order.Items)
                        productsById[item.ProductId].QuantityOnHand -= item.Quantity;

                    order.Status = "Paid";
                }
                else
                {
                    // Payment succeeded, but stock needs manual review.
                    order.Status = "PaidInventoryIssue";
                }
            }

            db.ProcessedStripeEvents.Add(new ProcessedStripeEvent
            {
                EventId = stripeEvent.Id,
                Type = stripeEvent.Type
            });

            await db.SaveChangesAsync(ct);

            if (transaction is not null)
                await transaction.CommitAsync(ct);

            return Results.Ok();
        })
        .WithName("HandleStripeWebhook");

        return app;
    }

    public sealed record CheckoutRequest(List<CheckoutItemRequest>? Items);

    public sealed record CheckoutItemRequest(Guid ProductId, int Quantity);
}
