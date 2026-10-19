
using Ledger.Api.Data;
using Ledger.Api.Endpoints;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Net.Mail;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<LedgerDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Ledger")));

builder.Services
    .AddIdentity<IdentityUser, IdentityRole>()
    .AddEntityFrameworkStores<LedgerDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddScoped<OwnerProvisioner>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "__Host-Ledger.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.Path = "/";
    options.LoginPath = "/login";
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = true;
});

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("OwnerOnly", policy => policy.RequireRole("Owner"));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});

builder.Services
    .AddOptions<OwnerProvisioningOptions>()
    .Bind(builder.Configuration.GetSection("OwnerProvisioning"))
    .Validate(
        options => !options.Enabled ||
            (!string.IsNullOrWhiteSpace(options.Email) &&
             !string.IsNullOrWhiteSpace(options.Password)),
        "Owner provisioning requires an email and password when enabled.")
    .Validate(
        options => !options.Enabled ||
            (MailAddress.TryCreate(options.Email, out var address) &&
             address.Address == options.Email),
        "Owner provisioning requires a valid email address.");

var app = builder.Build();

var provisioningOptions = app.Services
    .GetRequiredService<IOptions<OwnerProvisioningOptions>>()
    .Value;

if (provisioningOptions.Enabled && !app.Environment.IsEnvironment("Testing"))
{
    await using var scope = app.Services.CreateAsyncScope();

    var provisioner = scope.ServiceProvider
        .GetRequiredService<OwnerProvisioner>();

    await provisioner.ProvisionAsync(
        provisioningOptions.Email!,
        provisioningOptions.Password!);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    application = "Ledger"
}))
.WithName("GetHealth")
.WithOpenApi();

app.MapAuthEndpoints();
app.MapProductEndpoints();

app.Run();

public partial class Program { }
