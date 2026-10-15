using Microsoft.AspNetCore.Identity;

namespace Ledger.Api.Services;

public sealed class OwnerProvisioner(
    UserManager<IdentityUser> userManager,
    RoleManager<IdentityRole> roleManager
)
{
    public async Task ProvisionAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        const string ownerRole = "Owner";

        var role = await roleManager.FindByNameAsync(ownerRole);

        if (role is null)
        {
            var roleResult = await roleManager.CreateAsync(new IdentityRole(ownerRole));

            if (!roleResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to create Owner role: {FormatErrors(roleResult.Errors)}"
                );
            }
        }

        var user = await userManager.FindByEmailAsync(email);

        if (user is not null)
        {
            if (!await userManager.IsInRoleAsync(user, ownerRole))
            {
                throw new InvalidOperationException(
                    "The configured Owner email already belongs to a non-owner account. " +
                    "Refusing to promote it automatically."
                );
            }

            return;
        }

        user = new IdentityUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var createdResult = await userManager.CreateAsync(user, password);

        if (!createdResult.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to create Owner account: {FormatErrors(createdResult.Errors)}"
            );
        }

        var addRoleResult = await userManager.AddToRoleAsync(user, ownerRole);

        if (!addRoleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);

            throw new InvalidOperationException(
                $"Failed to assign Owner role: {FormatErrors(addRoleResult.Errors)}"
            );
        }
    }

    private static string FormatErrors(IEnumerable<IdentityError> errors) =>
        string.Join("; ", errors.Select(error => error.Description));
}