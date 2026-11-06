using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public sealed record UpdateShipmentTrackingRequest(
    string? TrackingNumber,
    string? TrackingUrl);

public static class AdminOrderShipmentEndpoints
{
    public static IEndpointRouteBuilder MapAdminOrderShipmentEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPut(
            "/admin/orders/{orderId:guid}/shipments/{parcelNumber:int}/tracking",
            async (
                Guid orderId,
                int parcelNumber,
                UpdateShipmentTrackingRequest request,
                HttpContext http,
                IAntiforgery antiforgery,
                LedgerDbContext db,
                ShipmentNotificationQueue notificationQueue,
                ILogger<AdminOrderShipmentEndpointsMarker> logger,
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

                if (parcelNumber < 1)
                    return Results.BadRequest(new { message = "Parcel number must be at least 1." });

                var trackingNumber = request.TrackingNumber?.Trim();
                if (trackingNumber?.Length > 100)
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["trackingNumber"] = ["Tracking numbers cannot exceed 100 characters."]
                    });

                if (string.IsNullOrWhiteSpace(trackingNumber))
                    trackingNumber = null;

                var trackingUrl = request.TrackingUrl?.Trim();
                if (string.IsNullOrWhiteSpace(trackingUrl))
                    trackingUrl = null;

                if (trackingUrl is { Length: > 500 })
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["trackingUrl"] = ["Tracking URLs cannot exceed 500 characters."]
                    });

                if (trackingUrl is not null &&
                    (!Uri.TryCreate(trackingUrl, UriKind.Absolute, out var parsedUrl) ||
                     parsedUrl.Scheme != Uri.UriSchemeHttps))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["trackingUrl"] = ["Enter a valid HTTPS tracking URL."]
                    });
                }

                if (trackingNumber is null && trackingUrl is not null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["trackingUrl"] = ["A tracking URL requires a tracking number."]
                    });
                }

                var order = await db.Orders
                    .Include(item => item.Shipments)
                    .FirstOrDefaultAsync(item => item.Id == orderId, ct);

                if (order is null)
                    return Results.NotFound(new { message = "Order not found." });

                if (order.Status != "Paid")
                    return Results.BadRequest(new
                    {
                        message = "Tracking can only be managed for paid orders."
                    });

                var shipment = order.Shipments
                    .FirstOrDefault(item => item.ParcelNumber == parcelNumber);

                if (shipment is null)
                {
                    shipment = new OrderShipment
                    {
                        OrderId = order.Id,
                        ParcelNumber = parcelNumber,
                        Carrier = order.ShippingProvider,
                        ServiceName = order.ShippingServiceName,
                        ShippingAmount = parcelNumber == 1
                            ? order.ShippingAmount
                            : 0
                    };

                    order.Shipments.Add(shipment);
                }

                var previousTrackingNumber = shipment.TrackingNumber;
                var trackingChanged =
                    !string.Equals(
                        previousTrackingNumber,
                        trackingNumber,
                        StringComparison.Ordinal);

                shipment.TrackingNumber = trackingNumber;
                shipment.TrackingUrl = trackingNumber is null ? null : trackingUrl;

                if (trackingNumber is null)
                {
                    shipment.Status = "Pending";
                    shipment.ShippedAtUtc = null;
                    shipment.DeliveredAtUtc = null;
                }
                else
                {
                    shipment.Status = "Shipped";
                    shipment.ShippedAtUtc ??= DateTime.UtcNow;
                }

                var hasTracking = order.Shipments
                    .Any(item => !string.IsNullOrWhiteSpace(item.TrackingNumber));
                var allHaveTracking = order.Shipments
                    .All(item => !string.IsNullOrWhiteSpace(item.TrackingNumber));

                order.FulfillmentStatus = allHaveTracking
                    ? "Shipped"
                    : hasTracking
                        ? "PartiallyShipped"
                        : "Unfulfilled";

                await db.SaveChangesAsync(ct);

                var notificationQueued = false;

                if (trackingChanged &&
                    trackingNumber is not null &&
                    !string.IsNullOrWhiteSpace(order.CustomerEmail))
                {
                    notificationQueued = notificationQueue.TryQueue(
                        new ShipmentNotification(
                            order.CustomerEmail,
                            order.Id.ToString(),
                            shipment.ParcelNumber,
                            trackingNumber,
                            shipment.TrackingUrl));

                    if (!notificationQueued)
                    {
                        logger.LogError(
                            "Shipment notification queue is full. Notification for order {OrderId} was not queued.",
                            order.Id);
                    }
                }
                else if (trackingChanged &&
                         trackingNumber is not null)
                {
                    logger.LogWarning(
                        "Order {OrderId} has no customer email; shipment notification was skipped.",
                        order.Id);
                }

                return Results.Ok(new
                {
                    shipment = new
                    {
                        shipment.Id,
                        shipment.ParcelNumber,
                        shipment.Carrier,
                        shipment.ServiceName,
                        shipment.Status,
                        shipment.TrackingNumber,
                        shipment.TrackingUrl,
                        shipment.ShippedAtUtc
                    },
                    fulfillmentStatus = order.FulfillmentStatus,
                    notificationQueued
                });
            })
            .RequireAuthorization("OwnerOnly")
            .WithName("UpdateOrderShipmentTracking");

        return app;
    }

    private sealed class AdminOrderShipmentEndpointsMarker;
}
