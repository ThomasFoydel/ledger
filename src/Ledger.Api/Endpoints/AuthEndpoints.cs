using Ledger.Api.Data;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

namespace Ledger.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapGet("/auth/csrf", (
            IAntiforgery antiforgery,
            HttpContext context) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(context);

            return Results.Ok(new { requestToken = tokens.RequestToken });
        });

        app.MapPost("/auth/login", async (
            LoginRequest request,
            UserManager<IdentityUser> userManager,
            SignInManager<IdentityUser> signInManager,
            IAntiforgery antiforgery,
            HttpContext context) =>
        {
            try
            {
                await antiforgery.ValidateRequestAsync(context);
            }
            catch (AntiforgeryValidationException)
            {
                return Results.BadRequest(new
                {
                    error = "Invalid antiforgery token."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return Results.BadRequest(new
                {
                    error = "Email and password are required."
                });
            }

            var user = await userManager.FindByEmailAsync(request.Email);

            if (user is null)
                return Results.Unauthorized();

            var result = await signInManager.PasswordSignInAsync(
                user,
                request.Password,
                isPersistent: true,
                lockoutOnFailure: true);

            if (!result.Succeeded)
                return Results.Unauthorized();

            return Results.NoContent();
        });

        app.MapPost("/auth/register", async (
            RegisterRequest request,
            UserManager<IdentityUser> userManager,
            SignInManager<IdentityUser> signInManager,
            IAntiforgery antiforgery,
            HttpContext context) =>
        {
            try
            {
                await antiforgery.ValidateRequestAsync(context);
            }
            catch (AntiforgeryValidationException)
            {
                return Results.BadRequest(new
                {
                    error = "Invalid antiforgery token."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return Results.BadRequest(new
                {
                    error = "Email and password are required."
                });
            }

            var email = request.Email.Trim();

            if (await userManager.FindByEmailAsync(email) is not null)
            {
                return Results.Conflict(new
                {
                    error = "An account with this email already exists."
                });
            }

            var user = new IdentityUser
            {
                UserName = email,
                Email = email
            };

            var result = await userManager.CreateAsync(user, request.Password);

            if (!result.Succeeded)
            {
                var errors = result.Errors
                    .Select(error => error.Description)
                    .ToArray();

                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["registration"] = errors
                });
            }

            await signInManager.SignInAsync(user, isPersistent: true);

            return Results.NoContent();
        });

        app.MapPost("/auth/logout", async (
            SignInManager<IdentityUser> signInManager,
            IAntiforgery antiforgery,
            HttpContext context) =>
        {
            try
            {
                await antiforgery.ValidateRequestAsync(context);
            }
            catch (AntiforgeryValidationException)
            {
                return Results.BadRequest(new
                {
                    error = "Invalid antiforgery token."
                });
            }

            await signInManager.SignOutAsync();

            return Results.NoContent();
        });

        app.MapGet("/auth/me", async (
            UserManager<IdentityUser> userManager,
            HttpContext context) =>
        {
            var user = await userManager.GetUserAsync(context.User);

            if (user is null)
                return Results.Unauthorized();

            var roles = await userManager.GetRolesAsync(user);

            return Results.Ok(new
            {
                email = user.Email,
                isAdmin = roles.Contains("Owner")
            });
        })
        .RequireAuthorization();

        return app;
    }

    public sealed record LoginRequest(string Email, string Password);
    public sealed record RegisterRequest(string Email, string Password);
}
