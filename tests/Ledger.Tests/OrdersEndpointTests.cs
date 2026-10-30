using System.Net;
using System.Net.Http.Json;
using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ledger.Tests;

public class OrdersEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public OrdersEndpointTests()
    {
        var databaseName = Guid.NewGuid().ToString();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<DbContextOptions<LedgerDbContext>>();
                    services.RemoveAll<LedgerDbContext>();

                    services.AddDbContext<LedgerDbContext>(options =>
                        options.UseInMemoryDatabase(databaseName));

                    services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = "Test";
                        options.DefaultChallengeScheme = "Test";
                        options.DefaultForbidScheme = "Test";
                    })
                    .AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>(
                        "Test",
                        _ => { });
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
    public async Task GetOrders_WithoutAuthentication_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/orders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetOrders_ReturnsOnlyAuthenticatedUsersOrders()
    {
        var customerOrder = new Order
        {
            UserId = "test-customer-a",
            Status = "Paid",
            Currency = "usd",
            TotalAmount = 15m,
            CustomerEmail = "customer-a@example.com",
            Items =
            [
                new OrderItem
                {
                    ProductId = Guid.NewGuid(),
                    ProductName = "Lavender Soap",
                    UnitPrice = 7.50m,
                    Quantity = 2
                }
            ]
        };

        var otherCustomerOrder = new Order
        {
            UserId = "test-customer-b",
            Status = "Paid",
            Currency = "usd",
            TotalAmount = 99m,
            CustomerEmail = "customer-b@example.com",
            Items =
            [
                new OrderItem
                {
                    ProductId = Guid.NewGuid(),
                    ProductName = "Private Product",
                    UnitPrice = 99m,
                    Quantity = 1
                }
            ]
        };

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>();
            db.Orders.AddRange(customerOrder, otherCustomerOrder);
            await db.SaveChangesAsync();
        }

        _client.DefaultRequestHeaders.Add("X-Test-Auth", "customer-a");

        var response = await _client.GetAsync("/orders");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var orders = await response.Content.ReadFromJsonAsync<List<OrderResponse>>();

        var order = Assert.Single(orders!);
        Assert.Equal(customerOrder.Id, order.Id);
        Assert.Equal("Paid", order.Status);
        Assert.Equal(15m, order.TotalAmount);

        var item = Assert.Single(order.Items);
        Assert.Equal("Lavender Soap", item.ProductName);
        Assert.Equal(7.50m, item.UnitPrice);
        Assert.Equal(2, item.Quantity);
    }

    [Fact]
    public async Task GetOrders_WhenCustomerHasNoOrders_ReturnsEmptyList()
    {
        _client.DefaultRequestHeaders.Add("X-Test-Auth", "customer-with-no-orders");

        var response = await _client.GetAsync("/orders");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var orders = await response.Content.ReadFromJsonAsync<List<OrderResponse>>();

        Assert.NotNull(orders);
        Assert.Empty(orders);
    }

    private sealed record OrderResponse(
        Guid Id,
        string Status,
        string Currency,
        decimal TotalAmount,
        DateTime CreatedAtUtc,
        DateTime? PaidAtUtc,
        List<OrderItemResponse> Items);

    private sealed record OrderItemResponse(
        Guid ProductId,
        string ProductName,
        decimal UnitPrice,
        int Quantity);
}
