using System.Net;
using System.Text;
using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Stripe;
using System.Security.Cryptography;

namespace Ledger.Tests;

public class StripeWebhookTests : IDisposable
{
    private const string WebhookSecret =
        "whsec_test_ledger_webhook_secret";

    private const string EventId = "evt_test_checkout_completed";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly string _databaseName = Guid.NewGuid().ToString();

    public StripeWebhookTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");

                builder.ConfigureAppConfiguration((_, configuration) =>
                {
                    configuration.AddInMemoryCollection(
                        new Dictionary<string, string?>
                        {
                            ["Stripe:WebhookSecret"] = WebhookSecret
                        });
                });

                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<DbContextOptions<LedgerDbContext>>();
                    services.RemoveAll<LedgerDbContext>();

                    services.AddDbContext<LedgerDbContext>(options =>
                        options.UseInMemoryDatabase(_databaseName));
                });
            });

        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task CheckoutCompleted_ProcessesPaymentAndDeductsInventoryOnlyOnce()
    {
        var product = new Ledger.Api.Models.Product
        {
            Name = "Lavender Soap",
            Price = 10m,
            QuantityOnHand = 5,
            IsActive = true
        };

        var order = new Order
        {
            Status = "Pending",
            Currency = "usd",
            TotalAmount = 20m,
            StripeCheckoutSessionId = "cs_test_ledger_webhook",
            Items =
            [
                new OrderItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = 2
                }
            ]
        };

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>();
            db.Products.Add(product);
            db.Orders.Add(order);
            await db.SaveChangesAsync();
        }

        var payload = $$"""
        {
            "id": "{{EventId}}",
            "object": "event",
            "api_version": "2026-09-30.endive",
            "created": 1793304969,
            "livemode": false,
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_ledger_webhook",
                    "object": "checkout.session",
                    "payment_status": "paid",
                    "status": "complete",
                    "metadata": {
                        "orderId": "{{order.Id}}"
                    },
                    "customer_details": {
                        "email": "customer@example.com"
                    }
                }
            }
        }
        """;

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var signedPayload = $"{timestamp}.{payload}";
        var key = Encoding.UTF8.GetBytes(WebhookSecret);
        var signatureBytes = HMACSHA256.HashData(
            key,
            Encoding.UTF8.GetBytes(signedPayload));
        var signature = $"t={timestamp},v1={Convert.ToHexString(signatureBytes).ToLowerInvariant()}";

        async Task<HttpResponseMessage> SendWebhook()
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                "/stripe/webhook");

            request.Headers.Add("Stripe-Signature", signature);
            request.Content = new StringContent(
                payload,
                Encoding.UTF8,
                "application/json");

            return await _client.SendAsync(request);
        }

        using var firstResponse = await SendWebhook();

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>();

            var savedOrder = await db.Orders
                .Include(item => item.Items)
                .SingleAsync(item => item.Id == order.Id);

            var savedProduct = await db.Products
                .SingleAsync(item => item.Id == product.Id);

            Assert.Equal("Paid", savedOrder.Status);
            Assert.Equal("customer@example.com", savedOrder.CustomerEmail);
            Assert.NotNull(savedOrder.PaidAtUtc);
            Assert.Equal(3, savedProduct.QuantityOnHand);

            Assert.True(await db.ProcessedStripeEvents.AnyAsync(
                item => item.EventId == EventId));
        }

        // Stripe may retry webhook delivery. Processing the same event
        // again must not deduct inventory a second time.
        using var secondResponse = await SendWebhook();

        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>();

            var savedProduct = await db.Products
                .SingleAsync(item => item.Id == product.Id);

            Assert.Equal(3, savedProduct.QuantityOnHand);
            Assert.Equal(
                1,
                await db.ProcessedStripeEvents.CountAsync(
                    item => item.EventId == EventId));
        }
    }
}
