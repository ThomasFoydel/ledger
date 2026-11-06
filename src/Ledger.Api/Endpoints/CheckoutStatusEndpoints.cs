using Ledger.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class CheckoutStatusEndpoints
{
    public static IEndpointRouteBuilder MapCheckoutStatusEndpoints(
        this IEndpointRouteBuilder app)
    {
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

        return app;
    }
}
