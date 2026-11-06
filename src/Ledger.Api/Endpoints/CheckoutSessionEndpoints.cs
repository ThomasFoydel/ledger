using System.Security.Claims;
using System.Text.Json;
using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace Ledger.Api.Endpoints;

public static class CheckoutSessionEndpoints
{
    public static IEndpointRouteBuilder MapCheckoutSessionEndpoints(
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
            var validationError = CheckoutRequestValidator.Validate(request);

            if (validationError is not null)
                return Results.BadRequest(new { error = validationError });

            var items = request.Items!;
            var shippingRateIds = request.ShippingRateIds!;
            var shippingServiceToken = request.ShippingServiceToken!;
            var destination = request.Destination!;
            var productIds = items
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

            foreach (var item in items)
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

            if (shippingRateIds.Count != parcels.Count ||
                shippingRateIds.Any(string.IsNullOrWhiteSpace) ||
                shippingRateIds.Distinct(StringComparer.Ordinal).Count()
                    != shippingRateIds.Count)
            {
                return Results.BadRequest(new
                {
                    error = "Your shipping quote is invalid. Please request new rates."
                });
            }

            var shippingAddress = CheckoutRequestValidator.CreateShippingAddress(destination);

            IReadOnlyList<ValidatedShippoRate> validatedRates;

            try
            {
                validatedRates = await shippo.ValidateRatesAsync(
                    shippingAddress,
                    parcels,
                    shippingServiceToken,
                    shippingRateIds,
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
                    rate.ServiceToken != shippingServiceToken))
            {
                return Results.BadRequest(new
                {
                    error = "Your shipping quote is invalid. Please request new rates."
                });
            }

            var shippingAmount = validatedRates.Sum(rate => rate.Amount);
            var subtotalAmount = items.Sum(item =>
                productById[item.ProductId].Price * item.Quantity);
            var totalAmount = subtotalAmount + shippingAmount;

            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);

            var orderItems = items.Select(item =>
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
                    validatedRates.Select(rate => rate.RateId).ToArray()),
                Shipments = validatedRates.Select((rate, index) => new OrderShipment
                {
                    ParcelNumber = index + 1,
                    ShippingRateId = rate.RateId,
                    Carrier = rate.Provider,
                    ServiceName = rate.ServiceName,
                    ShippingAmount = rate.Amount
                }).ToList()
            };

            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);

            try
            {
                var session = await StripeCheckoutSessionCreator.CreateAsync(
                    order,
                    orderItems,
                    shippingAmount,
                    selectedService,
                    configuration,
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
