using System.Security.Claims;
using System.Text.Json;
using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
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
            ClaimsPrincipal user,
            LedgerDbContext db,
            ShippoShippingService shippo,
            IConfiguration configuration,
            CancellationToken ct) =>
        {
            if (request.Items is null ||
                request.Items.Count is 0 or > 50 ||
                request.Items.Any(item =>
                    item.ProductId == Guid.Empty ||
                    item.Quantity is < 1 or > 500) ||
                request.Items.Select(item => item.ProductId).Distinct().Count()
                    != request.Items.Count)
            {
                return Results.BadRequest(new
                {
                    error = "Provide 1–50 distinct products with valid quantities."
                });
            }

            var destination = request.Destination;

            if (destination is null ||
                string.IsNullOrWhiteSpace(destination.Name) ||
                string.IsNullOrWhiteSpace(destination.Street1) ||
                string.IsNullOrWhiteSpace(destination.City) ||
                string.IsNullOrWhiteSpace(destination.State) ||
                string.IsNullOrWhiteSpace(destination.PostalCode) ||
                !System.Text.RegularExpressions.Regex.IsMatch(
                    destination.PostalCode, @"^\d{5}(-\d{4})?$") ||
                !string.Equals(
                    destination.Country, "US",
                    StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new
                {
                    error = "Provide a valid US shipping address."
                });
            }

            if (destination.Name.Length > 100 ||
                destination.Street1.Length > 200 ||
                (destination.Street2?.Length ?? 0) > 200 ||
                destination.City.Length > 100 ||
                destination.State.Length > 50)
            {
                return Results.BadRequest(new
                {
                    error = "One or more address fields are too long."
                });
            }

            if (string.IsNullOrWhiteSpace(request.ShippingServiceToken) ||
                request.ShippingRateIds is null)
            {
                return Results.BadRequest(new
                {
                    error = "Select a shipping service and request shipping rates."
                });
            }

            var productIds = request.Items
                .Select(item => item.ProductId)
                .ToArray();

            var products = await db.Products
                .AsNoTracking()
                .Where(product =>
                    productIds.Contains(product.Id) && product.IsActive)
                .ToListAsync(ct);

            if (products.Count != productIds.Length)
            {
                return Results.BadRequest(new
                {
                    error = "One or more products are unavailable. Refresh your cart."
                });
            }

            var productById = products.ToDictionary(product => product.Id);
            var totalBars = 0;

            foreach (var item in request.Items)
            {
                var product = productById[item.ProductId];

                if (product.Price <= 0 ||
                    item.Quantity > product.QuantityOnHand)
                {
                    return Results.BadRequest(new
                    {
                        error = "A product is out of stock or has an invalid price."
                    });
                }

                totalBars += item.Quantity;

                if (totalBars > 500)
                {
                    return Results.BadRequest(new
                    {
                        error = "Shipping estimates support up to 500 bars per order."
                    });
                }
            }

            var parcels = ShippingPackageCalculator.Calculate(totalBars);

            if (request.ShippingRateIds.Count != parcels.Count ||
                request.ShippingRateIds.Any(string.IsNullOrWhiteSpace) ||
                request.ShippingRateIds.Distinct(StringComparer.Ordinal).Count()
                    != request.ShippingRateIds.Count)
            {
                return Results.BadRequest(new
                {
                    error = "Your shipping quote is invalid. Please request new rates."
                });
            }

            var shippingAddress = new ShippingAddress(
                destination.Name.Trim(),
                destination.Street1.Trim(),
                string.IsNullOrWhiteSpace(destination.Street2)
                    ? null
                    : destination.Street2.Trim(),
                destination.City.Trim(),
                destination.State.Trim(),
                destination.PostalCode.Trim(),
                "US");

            IReadOnlyList<ValidatedShippoRate> validatedRates;

            try
            {
                validatedRates = await shippo.ValidateRatesAsync(
                    shippingAddress,
                    parcels,
                    request.ShippingServiceToken,
                    request.ShippingRateIds,
                    ct);
            }
            catch (InvalidShippingRateException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (HttpRequestException)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Unable to verify shipping rates.",
                    detail: "Please request new shipping rates and try again.");
            }
            catch (InvalidOperationException)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Shipping is not configured.");
            }

            if (validatedRates.Count != parcels.Count ||
                validatedRates.Any(rate =>
                    rate.ServiceToken != request.ShippingServiceToken))
            {
                return Results.BadRequest(new
                {
                    error = "Your shipping quote is invalid. Please request new rates."
                });
            }

            var shippingAmount = validatedRates.Sum(rate => rate.Amount);
            var subtotalAmount = request.Items.Sum(item =>
                productById[item.ProductId].Price * item.Quantity);
            var totalAmount = subtotalAmount + shippingAmount;

            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);

            var orderItems = request.Items.Select(item =>
            {
                var product = productById[item.ProductId];

                return new OrderItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = item.Quantity
                };
            }).ToList();

            var selectedService = validatedRates[0];

            var order = new Order
            {
                UserId = userId,
                Items = orderItems,
                SubtotalAmount = subtotalAmount,
                ShippingAmount = shippingAmount,
                TotalAmount = totalAmount,
                ShippingServiceToken = selectedService.ServiceToken,
                ShippingServiceName = selectedService.ServiceName,
                ShippingProvider = selectedService.Provider,
                ShippingName = shippingAddress.Name,
                ShippingStreet1 = shippingAddress.Street1,
                ShippingStreet2 = shippingAddress.Street2,
                ShippingCity = shippingAddress.City,
                ShippingState = shippingAddress.State,
                ShippingPostalCode = shippingAddress.PostalCode,
                ShippingCountry = shippingAddress.Country,
                ShippingRateIdsJson = JsonSerializer.Serialize(
                    validatedRates.Select(rate => rate.RateId).ToArray())
            };

            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);

            try
            {
                var lineItems = orderItems.Select(item =>
                    new SessionLineItemOptions
                    {
                        Quantity = item.Quantity,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            UnitAmount = decimal.ToInt64(
                                decimal.Round(
                                    item.UnitPrice * 100,
                                    0,
                                    MidpointRounding.AwayFromZero)),
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = item.ProductName
                            }
                        }
                    }).ToList();

                lineItems.Add(new SessionLineItemOptions
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "usd",
                        UnitAmount = decimal.ToInt64(
                            decimal.Round(
                                shippingAmount * 100,
                                0,
                                MidpointRounding.AwayFromZero)),
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"USPS {selectedService.ServiceName}"
                        }
                    }
                });

                var options = new SessionCreateOptions
                {
                    Mode = "payment",
                    LineItems = lineItems,
                    SuccessUrl = configuration["Stripe:SuccessUrl"],
                    CancelUrl = configuration["Stripe:CancelUrl"],
                    ClientReferenceId = order.Id.ToString(),
                    Metadata = new Dictionary<string, string>
                    {
                        ["orderId"] = order.Id.ToString()
                    },
                    ShippingAddressCollection = new SessionShippingAddressCollectionOptions
                    {
                        AllowedCountries = new List<string> { "US" }
                    }
                };

                var service = new SessionService();
                var session = await service.CreateAsync(
                    options,
                    new RequestOptions
                    {
                        IdempotencyKey = $"checkout-{order.Id}"
                    },
                    ct);

                order.StripeCheckoutSessionId = session.Id;
                await db.SaveChangesAsync(ct);

                return Results.Ok(new
                {
                    sessionId = session.Id,
                    url = session.Url
                });
            }
            catch (StripeException ex)
            {
                Console.Error.WriteLine(
                    $"Stripe checkout failed. Type: {ex.StripeError?.Type}; " +
                    $"Code: {ex.StripeError?.Code}; Message: {ex.Message}");

                order.Status = "CheckoutFailed";
                await db.SaveChangesAsync(ct);

                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Unable to start checkout.",
                    detail: "Please try again in a moment.");
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
                .Where(order => order.StripeCheckoutSessionId == sessionId)
                .Select(order => new
                {
                    order.Id,
                    order.Status
                })
                .FirstOrDefaultAsync(ct);

            return order is null
                ? Results.NotFound()
                : Results.Ok(new
                {
                    orderId = order.Id,
                    status = order.Status
                });
        })
        .WithName("GetCheckoutSession");

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

    public sealed record CheckoutRequest(
        List<CheckoutItemRequest>? Items,
        CheckoutDestinationRequest? Destination,
        string? ShippingServiceToken,
        List<string>? ShippingRateIds);

    public sealed record CheckoutItemRequest(
        Guid ProductId,
        int Quantity);

    public sealed record CheckoutDestinationRequest(
        string Name,
        string Street1,
        string? Street2,
        string City,
        string State,
        string PostalCode,
        string Country);
}
