using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public sealed record SetOrderArchiveRequest(bool IsArchived);

public static class AdminOrderEndpoints
{
    public static IEndpointRouteBuilder MapAdminOrderEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapGet("/admin/orders", async (
            string? search,
            string? archive,
            int? page,
            int? pageSize,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var currentPage = Math.Max(1, page ?? 1);
            var currentPageSize = Math.Clamp(pageSize ?? 20, 1, 100);

            var query = db.Orders.AsNoTracking();

            if (string.Equals(archive, "active", StringComparison.OrdinalIgnoreCase))
                query = query.Where(order => !order.IsArchived);
            else if (string.Equals(archive, "archived", StringComparison.OrdinalIgnoreCase))
                query = query.Where(order => order.IsArchived);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = $"%{search.Trim()}%";
                query = query.Where(order =>
                    (order.CustomerEmail != null && EF.Functions.ILike(order.CustomerEmail, pattern)) ||
                    (order.ShippingName != null && EF.Functions.ILike(order.ShippingName, pattern)) ||
                    (order.ShippingCity != null && EF.Functions.ILike(order.ShippingCity, pattern)) ||
                    EF.Functions.ILike(order.Status, pattern) ||
                    EF.Functions.ILike(order.FulfillmentStatus, pattern) ||
                    order.Items.Any(item => EF.Functions.ILike(item.ProductName, pattern)) ||
                    order.Shipments.Any(shipment =>
                        shipment.TrackingNumber != null &&
                        EF.Functions.ILike(shipment.TrackingNumber, pattern)));
            }

            var totalCount = await query.CountAsync(ct);

            var items = await query
                .OrderByDescending(order => order.CreatedAtUtc)
                .ThenByDescending(order => order.Id)
                .Skip((currentPage - 1) * currentPageSize)
                .Take(currentPageSize)
                .Select(order => new
                {
                    order.Id,
                    order.CustomerEmail,
                    order.UserId,
                    order.Status,
                    order.FulfillmentStatus,
                    order.IsArchived,
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

            return Results.Ok(new
            {
                items,
                totalCount,
                page = currentPage,
                pageSize = currentPageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)currentPageSize)
            });
        })
        .RequireAuthorization("OwnerOnly")
        .WithName("GetAllOrders");

        app.MapPut("/admin/orders/{orderId:guid}/archive", async (
            Guid orderId,
            SetOrderArchiveRequest request,
            HttpContext http,
            IAntiforgery antiforgery,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            try
            {
                await antiforgery.ValidateRequestAsync(http);
            }
            catch (AntiforgeryValidationException)
            {
                return Results.BadRequest(new
                {
                    message = "The security token is invalid or expired. Refresh the page and try again."
                });
            }

            var order = await db.Orders
                .FirstOrDefaultAsync(item => item.Id == orderId, ct);

            if (order is null)
                return Results.NotFound();

            order.IsArchived = request.IsArchived;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { order.Id, order.IsArchived });
        })
        .RequireAuthorization("OwnerOnly")
        .WithName("SetOrderArchive");



        app.MapAdminOrderShipmentEndpoints();

        return app;
    }


}