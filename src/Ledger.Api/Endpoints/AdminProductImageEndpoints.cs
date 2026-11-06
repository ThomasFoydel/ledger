using Ledger.Api.Data;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class AdminProductImageEndpoints
{

    public static IEndpointRouteBuilder MapAdminProductImageEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPost("/products/{id:guid}/image", async (
            Guid id,
            HttpContext http,
            IFormFile file,
            LedgerDbContext db,
            NeonObjectStorage storage,
            IAntiforgery antiforgery,
            CancellationToken ct) =>
        {
            try
            {
                await antiforgery.ValidateRequestAsync(http);
            }
            catch (AntiforgeryValidationException)
            {
                return Results.BadRequest(new { error = "Invalid CSRF token." });
            }

            if (file.Length is <= 0 or > ImageValidation.MaxImageBytes)
            {
                return Results.BadRequest(new
                {
                    error = "Choose an image smaller than 2 MB."
                });
            }

            var product = await db.Products
                .FirstOrDefaultAsync(product => product.Id == id, ct);

            if (product is null)
                return Results.NotFound();

            await using var input = file.OpenReadStream();
            using var output = new MemoryStream();

            await input.CopyToAsync(output, ct);

            var data = output.ToArray();
            var contentType = ImageValidation.DetectImageType(data);

            if (contentType is null)
            {
                return Results.BadRequest(new
                {
                    error = "Use a valid PNG, JPEG, or WebP image."
                });
            }

            var key = product.ImageKey ?? $"products/{product.Id}/image";

            await storage.PutAsync(key, data, contentType, ct);

            product.ImageKey = key;

            await db.SaveChangesAsync(ct);

            return Results.NoContent();
        })
        .RequireAuthorization("OwnerOnly")
        .DisableAntiforgery();

        return app;
    }

}
