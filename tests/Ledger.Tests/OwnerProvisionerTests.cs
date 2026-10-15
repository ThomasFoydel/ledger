using Ledger.Api.Data;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ledger.Tests;

public class OwnerProvisionerTests
{
    private const string Email = "owner@example.com";
    private const string Password = "Test-password-123";

    private static ServiceProvider CreateServices()
    {
        var services = new ServiceCollection();

        services.AddLogging();

        services.AddDbContext<LedgerDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()
        ));

        services
            .AddIdentity<IdentityUser, IdentityRole>()
            .AddEntityFrameworkStores<LedgerDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<OwnerProvisioner>();

        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task ProvisionAsync_CreatesOwnerRoleAndUser()
    {
        using var provider = CreateServices();
        await using var scope = provider.CreateAsyncScope();

        var provisioner =
            scope.ServiceProvider.GetRequiredService<OwnerProvisioner>();
        var userManager =
            scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var roleManager =
            scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        await provisioner.ProvisionAsync(Email, Password);

        var user = await userManager.FindByEmailAsync(Email);

        Assert.NotNull(user);
        Assert.True(await roleManager.RoleExistsAsync("Owner"));
        Assert.True(await userManager.IsInRoleAsync(user!, "Owner"));
        Assert.True(await userManager.CheckPasswordAsync(user!, Password));
    }

    [Fact]
    public async Task ProvisionAsync_WhenRunTwice_DoesNotDuplicateOrResetPassword()
    {
        using var provider = CreateServices();
        await using var scope = provider.CreateAsyncScope();

        var provisioner =
            scope.ServiceProvider.GetRequiredService<OwnerProvisioner>();
        var userManager =
            scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

        await provisioner.ProvisionAsync(Email, Password);

        var originalUser = await userManager.FindByEmailAsync(Email);
        Assert.NotNull(originalUser);

        await provisioner.ProvisionAsync(Email, "Different-password-456");

        var users = await userManager.Users.ToListAsync();
        var user = await userManager.FindByEmailAsync(Email);

        Assert.Single(users);
        Assert.Equal(originalUser!.Id, user!.Id);
        Assert.True(await userManager.CheckPasswordAsync(user, Password));
        Assert.False(
            await userManager.CheckPasswordAsync(user, "Different-password-456")
        );
    }

    [Fact]
    public async Task ProvisionAsync_WhenEmailBelongsToNonOwner_RefusesPromotion()
    {
        using var provider = CreateServices();
        await using var scope = provider.CreateAsyncScope();

        var userManager =
            scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var provisioner =
            scope.ServiceProvider.GetRequiredService<OwnerProvisioner>();

        var existingUSer = new IdentityUser
        {
            UserName = Email,
            Email = Email,
            EmailConfirmed = true
        };

        var createResult = await userManager.CreateAsync(existingUSer, Password);
        Assert.True(createResult.Succeeded);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => provisioner.ProvisionAsync(Email, Password)
        );

        Assert.False(await userManager.IsInRoleAsync(existingUSer, "Owner"));
    }

    [Fact]
    public async Task ProvisionAsync_WithWeakPAssword_DoesNotCreateUser()
    {
        using var provider = CreateServices();
        await using var scope = provider.CreateAsyncScope();

        var provisioner =
            scope.ServiceProvider.GetRequiredService<OwnerProvisioner>();
        var userManager =
            scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => provisioner.ProvisionAsync(Email, "weak")
        );

        Assert.Null(await userManager.FindByEmailAsync(Email));
    }
}