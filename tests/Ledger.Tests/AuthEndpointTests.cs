using Microsoft.AspNetCore.Hosting;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ledger.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ledger.Tests;

public class AuthEndpointTests : IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private const string Email = "owner@example.com";
    private const string Password = "Test-password-123!";

    public AuthEndpointTests()
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
                });
            });

        _client = _factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false,
                HandleCookies = true
            });
    }

    public async Task InitializeAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();

        var userManager =
            scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

        var user = new IdentityUser
        {
            UserName = Email,
            Email = Email,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(user, Password);

        Assert.True(
            result.Succeeded,
            string.Join("; ", result.Errors.Select(error => error.Description)));
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsNoContentAndAuthCookie()
    {
        var token = await GetCsrfTokenAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new
            {
                Email,
                Password
            })
        };

        request.Headers.Add("X-CSRF-TOKEN", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains(
            response.Headers.GetValues("Set-Cookie"),
            cookie => cookie.StartsWith("__Host-Ledger.Auth="));
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        var token = await GetCsrfTokenAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new
            {
                Email,
                Password = "Wrong-password-123!"
            })
        };

        request.Headers.Add("X-CSRF-TOKEN", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithoutCsrfToken_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync(
            "/auth/login",
            new { Email, Password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithMissingCredentials_ReturnsBadRequest()
    {
        var token = await GetCsrfTokenAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new
            {
                Email,
                Password = ""
            })
        };

        request.Headers.Add("X-CSRF-TOKEN", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Logout_WithoutCsrfToken_ReturnsBadRequest()
    {
        var response = await _client.PostAsync("/auth/logout", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Logout_WithCsrfToken_ReturnsNoContent()
    {
        var token = await GetCsrfTokenAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/logout");
        request.Headers.Add("X-CSRF-TOKEN", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private async Task<string> GetCsrfTokenAsync()
    {
        var response = await _client.GetAsync("/auth/csrf");

        response.EnsureSuccessStatusCode();

        using var json = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync());

        return json.RootElement.GetProperty("requestToken").GetString()
            ?? throw new InvalidOperationException("CSRF token was missing.");
    }
}
