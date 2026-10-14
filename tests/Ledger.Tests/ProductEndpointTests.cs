
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Ledger.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

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

        _client = _factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false
            });
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
        AuthenticateAsOwner();

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
        AuthenticateAsOwner();

        var request = new
        {
            Name = " ",
            Description = "Test soap",
            Price = 7.50m
        };

        var response = await _client.PostAsJsonAsync("/products", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateProduct_WithoutAuthentication_ReturnsUnauthorized()
    {
        var request = new
        {
            Name = "Lavender Soap",
            Description = "Test soap",
            Price = 7.50m
        };

        var response = await _client.PostAsJsonAsync("/products", request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProduct_WithoutAuthentication_ReturnsUnauthorized()
    {
        var response = await _client.PutAsJsonAsync(
            $"/products/{Guid.NewGuid()}",
            new
            {
                Name = "Updated Soap",
                Description = "Test soap",
                Price = 8.50m
            });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteProduct_WithoutAuthentication_ReturnsUnauthorized()
    {
        var response = await _client.DeleteAsync(
            $"/products/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateProduct_WithoutOwnerRole_ReturnsForbidden()
    {
        _client.DefaultRequestHeaders.Remove("X-Test-Auth");
        _client.DefaultRequestHeaders.Add("X-Test-Auth", "regular-user");

        var response = await _client.PostAsJsonAsync(
            "/products",
            new
            {
                Name = "Lavender Soap",
                Description = "Test soap",
                Price = 7.50m
            }
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private void AuthenticateAsOwner()
    {
        _client.DefaultRequestHeaders.Remove("X-Test-Auth");
        _client.DefaultRequestHeaders.Add("X-Test-Auth", "owner");
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

public sealed class TestAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-Auth", out var value))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new List<Claim>
        {
            new (ClaimTypes.NameIdentifier, $"test-{value}"),
            new (ClaimTypes.Name, value.ToString()),
        };

        if (value == "owner")
        {
            claims.Add(new Claim(ClaimTypes.Role, "Owner"));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
