using System.Security.Claims;
using Ledger.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class OrdersEndpoints
{
    public static IEndpointRouteBuilder MapOrdersEndpoints(
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
                    order.Currency,
                    order.TotalAmount,
                    order.CreatedAtUtc,
                    order.PaidAtUtc,
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

        app.MapGet("/admin/orders", async (
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var orders = await db.Orders
                .AsNoTracking()
                .OrderByDescending(order => order.CreatedAtUtc)
                .Select(order => new
                {
                    order.Id,
                    order.CustomerEmail,
                    order.UserId,
                    order.Status,
                    order.Currency,
                    order.TotalAmount,
                    order.CreatedAtUtc,
                    order.PaidAtUtc,
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
        .RequireAuthorization("OwnerOnly")
        .WithName("GetAllOrders");

        return app;
    }
}
