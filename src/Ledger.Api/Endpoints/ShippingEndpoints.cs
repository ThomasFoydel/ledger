using Ledger.Api.Data;
using Ledger.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class ShippingEndpoints
{
    public static IEndpointRouteBuilder MapShippingEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPost("/shipping/rates", async (
            ShippingRatesRequest request,
            LedgerDbContext db,
            ShippoShippingService shippo,
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

            IReadOnlyList<ShippoParcelRate> parcelRates;

            try
            {
                parcelRates = await shippo.GetRatesAsync(
                    shippingAddress,
                    parcels,
                    ct);
            }
            catch (HttpRequestException)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Unable to retrieve shipping rates.",
                    detail: "Please try again in a moment.");
            }
            catch (InvalidOperationException)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Shipping is not configured.");
            }

            var serviceGroups = parcelRates
                .GroupBy(rate => rate.ServiceToken)
                .Select(group =>
                {
                    var selectedRates = Enumerable.Range(0, parcels.Count)
                        .Select(parcelIndex => group
                            .Where(rate => rate.ParcelIndex == parcelIndex)
                            .OrderBy(rate => rate.Amount)
                            .FirstOrDefault())
                        .ToArray();

                    if (selectedRates.Any(rate => rate is null))
                        return null;

                    var rates = selectedRates
                        .Select(rate => rate!)
                        .ToArray();

                    return new
                    {
                        serviceToken = group.Key,
                        serviceName = rates[0].ServiceName,
                        provider = rates[0].Provider,
                        amount = rates.Sum(rate => rate.Amount),
                        currency = rates[0].Currency,
                        rateIds = rates.Select(rate => rate.RateId).ToArray(),
                        parcelCount = parcels.Count
                    };
                })
                .Where(option => option is not null)
                .OrderBy(option => option!.amount)
                .ToArray();

            return Results.Ok(new
            {
                totalBars,
                parcelCount = parcels.Count,
                rates = serviceGroups
            });
        })
        .WithName("GetShippingRates");

        return app;
    }

    public sealed record ShippingRatesRequest(
        List<ShippingItemRequest>? Items,
        ShippingDestinationRequest? Destination);

    public sealed record ShippingItemRequest(
        Guid ProductId,
        int Quantity);

    public sealed record ShippingDestinationRequest(
        string Name,
        string Street1,
        string? Street2,
        string City,
        string State,
        string PostalCode,
        string Country);
}
