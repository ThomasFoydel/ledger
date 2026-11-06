using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPublicProductEndpoints();
        app.MapAdminProductEndpoints();

        return app;
    }

    private static IEndpointRouteBuilder MapPublicProductEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapGet("/products", async (
            string? search,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var query = db.Products
                .AsNoTracking()
                .Where(product => product.IsActive);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = $"%{search.Trim()}%";
                query = query.Where(product =>
                    EF.Functions.ILike(product.Name, pattern) ||
                    (product.Description != null &&
                     EF.Functions.ILike(product.Description, pattern)) ||
                    product.Tags.Any(tag =>
                        EF.Functions.ILike(tag.Name, pattern)));
            }

            var products = await query
                .OrderBy(product => product.Name)
                .Select(product => new ProductResponse(
                    product.Id,
                    product.Name,
                    product.Description,
                    product.Price,
                    product.IsActive,
                    product.CreatedAtUtc,
                    product.QuantityOnHand,
                    product.ImageKey != null
                ))
                .ToListAsync(ct);

            return Results.Ok(products);
        });

        app.MapGet("/products/{id:guid}/tags", async (
            Guid id,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var productExists = await db.Products
                .AnyAsync(product => product.Id == id, ct);

            if (!productExists)
                return Results.NotFound();

            var tags = await db.ProductTags
                .AsNoTracking()
                .Where(tag => tag.ProductId == id)
                .OrderBy(tag => tag.Name)
                .Select(tag => tag.Name)
                .ToListAsync(ct);

            return Results.Ok(tags);
        })
        .RequireAuthorization("OwnerOnly");

        app.MapGet("/products/{id:guid}", async (
            Guid id,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var product = await db.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    product => product.Id == id && product.IsActive,
                    ct);

            return product is null
                ? Results.NotFound()
                : Results.Ok(ProductEndpointHelpers.ToResponse(product));
        })
        .WithName("GetProductById");

        app.MapGet("/products/{id:guid}/image", async (
            Guid id,
            HttpContext http,
            LedgerDbContext db,
            NeonObjectStorage storage,
            CancellationToken ct) =>
        {
            var product = await db.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(product =>
                    product.Id == id &&
                    product.IsActive &&
                    product.ImageKey != null, ct);

            if (product?.ImageKey is null)
                return Results.NotFound();

            var image = await storage.GetAsync(product.ImageKey, ct);

            if (image is null)
                return Results.NotFound();

            http.Response.Headers.CacheControl =
                "no-cache, no-store, must-revalidate";

            return Results.File(image.Value.Data, image.Value.ContentType);
        });

        return app;
    }
}
