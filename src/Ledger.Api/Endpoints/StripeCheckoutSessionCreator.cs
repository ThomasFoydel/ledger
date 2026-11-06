using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.Extensions.Configuration;
using Stripe;
using Stripe.Checkout;

namespace Ledger.Api.Endpoints;

internal static class StripeCheckoutSessionCreator
{
    internal static async Task<Session> CreateAsync(
        Order order,
        IReadOnlyList<OrderItem> orderItems,
        decimal shippingAmount,
        ValidatedShippoRate selectedService,
        IConfiguration configuration,
        CancellationToken cancellationToken)
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
            }
        };

        var service = new SessionService();

        return await service.CreateAsync(
            options,
            new RequestOptions
            {
                IdempotencyKey = $"checkout-{order.Id}"
            },
            cancellationToken);
    }
}
