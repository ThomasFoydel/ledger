using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class AdminProductEndpoints
{
    public static IEndpointRouteBuilder MapAdminProductEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapPost("/products", async (
            CreateProductRequest request,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var errors = ProductEndpointHelpers.Validate(
                request.Name,
                request.Description,
                request.Price,
                request.QuantityOnHand,
                request.Tags);

            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var product = new Product
            {
                Name = request.Name!.Trim(),
                Description = ProductEndpointHelpers.NormalizeDescription(
                    request.Description),
                Price = request.Price,
                QuantityOnHand = request.QuantityOnHand,
                Tags = ProductEndpointHelpers.CreateTags(request.Tags)
            };

            db.Products.Add(product);
            await db.SaveChangesAsync(ct);

            return Results.Created(
                $"/products/{product.Id}",
                ProductEndpointHelpers.ToResponse(product));
        })
        .RequireAuthorization("OwnerOnly");

        app.MapPut("/products/{id:guid}", async (
            Guid id,
            UpdateProductRequest request,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var errors = ProductEndpointHelpers.Validate(
                request.Name,
                request.Description,
                request.Price,
                request.QuantityOnHand,
                request.Tags);

            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var product = await db.Products
                .Include(product => product.Tags)
                .FirstOrDefaultAsync(product => product.Id == id, ct);

            if (product is null)
                return Results.NotFound();

            product.Name = request.Name!.Trim();
            product.Description = ProductEndpointHelpers.NormalizeDescription(
                request.Description);
            product.Price = request.Price;
            product.QuantityOnHand = request.QuantityOnHand;

            db.ProductTags.RemoveRange(product.Tags);
            product.Tags.Clear();

            var replacementTags =
                ProductEndpointHelpers.CreateTags(request.Tags);

            foreach (var tag in replacementTags)
                tag.ProductId = product.Id;

            db.ProductTags.AddRange(replacementTags);

            await db.SaveChangesAsync(ct);

            return Results.Ok(ProductEndpointHelpers.ToResponse(product));
        })
        .RequireAuthorization("OwnerOnly");



        app.MapDelete("/products/{id:guid}", async (
            Guid id,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var product = await db.Products
                .FirstOrDefaultAsync(
                    product => product.Id == id && product.IsActive,
                    ct);

            if (product is null)
                return Results.NotFound();

            product.IsActive = false;

            await db.SaveChangesAsync(ct);

            return Results.NoContent();
        })
        .RequireAuthorization("OwnerOnly");

        app.MapGet("/admin/products", async (
            string? search,
            string? visibility,
            int? page,
            int? pageSize,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var currentPage = Math.Max(1, page ?? 1);
            var currentPageSize = Math.Clamp(pageSize ?? 20, 1, 100);

            var query = db.Products.AsNoTracking();

            if (string.Equals(
                visibility, "active", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(product => product.IsActive);
            }
            else if (string.Equals(
                visibility, "hidden", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(product => !product.IsActive);
            }

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

            var totalCount = await query.CountAsync(ct);

            var items = await query
                .OrderBy(product => product.Name)
                .ThenBy(product => product.Id)
                .Skip((currentPage - 1) * currentPageSize)
                .Take(currentPageSize)
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

            return Results.Ok(new
            {
                items,
                totalCount,
                page = currentPage,
                pageSize = currentPageSize,
                totalPages = (int)Math.Ceiling(
                    totalCount / (double)currentPageSize)
            });
        })
        .RequireAuthorization("OwnerOnly")
        .WithName("GetAdminProducts");

        app.MapPut("/admin/products/{id:guid}/visibility", async (
            Guid id,
            SetProductVisibilityRequest request,
            HttpContext http,
            IAntiforgery antiforgery,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            try
            {
                await antiforgery.ValidateRequestAsync(http);
            }
            catch (AntiforgeryValidationException)
            {
                return Results.BadRequest(new { message = "Invalid CSRF token." });
            }

            var product = await db.Products
                .FirstOrDefaultAsync(item => item.Id == id, ct);

            if (product is null)
                return Results.NotFound();

            product.IsActive = request.IsActive;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { product.Id, product.IsActive });
        })
        .RequireAuthorization("OwnerOnly")
        .WithName("SetProductVisibility");

        app.MapAdminProductImageEndpoints();

        return app;
    }


}
