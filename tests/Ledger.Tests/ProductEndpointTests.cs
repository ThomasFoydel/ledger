using System.Net;
using System.Net.Http.Json;
using Ledger.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ledger.Tests;

public class ProductEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    public ProductEndpointTests()
    {
        var databaseName = Guid.NewGuid().ToString();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<DbContextOptions<LedgerDbContext>>();
                    services.RemoveAll<LedgerDbContext>();
                    services.AddDbContext<LedgerDbContext>(options =>
                        options.UseInMemoryDatabase(databaseName));
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
    public async Task CreateProduct_ReturnsCreatedProduct()
    {
        var request = new
        {
            Name = "Lavender Soap",
            Description = "Cold-process lavender soap",
            Price = 7.50m
        };

        var response = await _client.PostAsJsonAsync("/products", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var product = await response.Content.ReadFromJsonAsync<ProductResponse>();

        Assert.NotNull(product);

        Assert.Equal("Lavender Soap", product.Name);

        Assert.Equal(7.50m, product.Price);

        Assert.NotEqual(Guid.Empty, product.Id);
    }

    [Fact]
    public async Task CreateProduct_WithBlankName_ReturnsBadRequest()
    {
        var request = new
        {
            Name = " ",
            Description = "Test soap",
            Price = 7.50m
        };

        var response = await _client.PostAsJsonAsync("/products", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed record ProductResponse(
        Guid Id,
        string Name,
        string? Description,
        decimal Price,
        bool IsActive,
        DateTime CreatedAtUtc
    );
}