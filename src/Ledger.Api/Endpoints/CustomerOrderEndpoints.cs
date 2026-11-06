using System.Security.Claims;
using Ledger.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class CustomerOrderEndpoints
{
    public static IEndpointRouteBuilder MapCustomerOrderEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapGet("/orders", async (
            ClaimsPrincipal user,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Results.Unauthorized();

            var orders = await db.Orders
                .AsNoTracking()
                .Where(order => order.UserId == userId)
                .OrderByDescending(order => order.CreatedAtUtc)
                .Select(order => new
                {
                    order.Id,
                    order.Status,
                    order.FulfillmentStatus,
                    order.Currency,
                    order.SubtotalAmount,
                    order.ShippingAmount,
                    order.TotalAmount,
                    order.ShippingServiceToken,
                    order.ShippingServiceName,
                    order.ShippingProvider,
                    order.ShippingName,
                    order.ShippingStreet1,
                    order.ShippingStreet2,
                    order.ShippingCity,
                    order.ShippingState,
                    order.ShippingPostalCode,
                    order.ShippingCountry,
                    order.CreatedAtUtc,
                    order.PaidAtUtc,
                    Shipments = order.Shipments
                        .OrderBy(shipment => shipment.ParcelNumber)
                        .Select(shipment => new
                        {
                            shipment.Id,
                            shipment.ParcelNumber,
                            shipment.Carrier,
                            shipment.ServiceName,
                            shipment.Status,
                            shipment.TrackingNumber,
                            shipment.TrackingUrl,
                            shipment.ShippedAtUtc
                        }).ToList(),
                    Items = order.Items.Select(item => new
                    {
                        item.ProductId,
                        item.ProductName,
                        item.UnitPrice,
                        item.Quantity
                    }).ToList()
                })
                .ToListAsync(ct);

            return Results.Ok(orders);
        })
        .RequireAuthorization()
        .WithName("GetCustomerOrders");

        return app;
    }
}