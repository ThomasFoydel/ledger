using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class ProductEndpoints
{
    private const long MaxImageBytes = 2 * 1024 * 1024;

    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
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
                    (product.Description != null && EF.Functions.ILike(product.Description, pattern)) ||
                    product.Tags.Any(tag => EF.Functions.ILike(tag.Name, pattern)));
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
                .AnyAsync(product => product.Id == id && product.IsActive, ct);

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
                .FirstOrDefaultAsync(product => product.Id == id && product.IsActive, ct);

            return product is null
                ? Results.NotFound()
                : Results.Ok(ToResponse(product));
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

            http.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";

            return Results.File(image.Value.Data, image.Value.ContentType);
        });

        app.MapPost("/products", async (
            CreateProductRequest request,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var errors = Validate(
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
                Description = NormalizeDescription(request.Description),
                Price = request.Price,
                QuantityOnHand = request.QuantityOnHand,
                Tags = CreateTags(request.Tags)
            };

            db.Products.Add(product);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/products/{product.Id}", ToResponse(product));
        })
        .RequireAuthorization("OwnerOnly");

        app.MapPut("/products/{id:guid}", async (
            Guid id,
            UpdateProductRequest request,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var errors = Validate(
                request.Name,
                request.Description,
                request.Price,
                request.QuantityOnHand,
                request.Tags);

            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var product = await db.Products
                .Include(product => product.Tags)
                .FirstOrDefaultAsync(product =>
                    product.Id == id && product.IsActive, ct);

            if (product is null)
                return Results.NotFound();

            product.Name = request.Name!.Trim();
            product.Description = NormalizeDescription(request.Description);
            product.Price = request.Price;
            product.QuantityOnHand = request.QuantityOnHand;

            db.ProductTags.RemoveRange(product.Tags);
            product.Tags.Clear();

            var replacementTags = CreateTags(request.Tags);
            foreach (var tag in replacementTags)
                tag.ProductId = product.Id;

            db.ProductTags.AddRange(replacementTags);

            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(product));
        })
        .RequireAuthorization("OwnerOnly");

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

            if (file.Length is <= 0 or > MaxImageBytes)
            {
                return Results.BadRequest(new
                {
                    error = "Choose an image smaller than 2 MB."
                });
            }

            var product = await db.Products
                .FirstOrDefaultAsync(product =>
                    product.Id == id && product.IsActive, ct);

            if (product is null)
                return Results.NotFound();

            await using var input = file.OpenReadStream();
            using var output = new MemoryStream();

            await input.CopyToAsync(output, ct);

            var data = output.ToArray();
            var contentType = DetectImageType(data);

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

        app.MapDelete("/products/{id:guid}", async (
            Guid id,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var product = await db.Products
                .FirstOrDefaultAsync(product =>
                    product.Id == id && product.IsActive, ct);

            if (product is null)
                return Results.NotFound();

            product.IsActive = false;

            await db.SaveChangesAsync(ct);

            return Results.NoContent();
        })
        .RequireAuthorization("OwnerOnly");

        return app;
    }

    private static Dictionary<string, string[]> Validate(
        string? name,
        string? description,
        decimal price,
        int quantityOnHand,
        string[]? tags)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(name))
            errors["name"] = ["Name is required."];
        else if (name.Trim().Length > 200)
            errors["name"] = ["Name cannot exceed 200 characters."];

        if (description?.Length > 2000)
            errors["description"] = ["Description cannot exceed 2000 characters."];

        if (price < 0 || price > 99999999.99m)
            errors["price"] = ["Price must be between 0 and 99999999.99."];

        if (quantityOnHand < 0)
            errors["quantityOnHand"] = ["Quantity cannot be negative."];

        var normalizedTags = NormalizeTags(tags);

        if (normalizedTags.Length > 20)
            errors["tags"] = ["A product cannot have more than 20 tags."];
        else if (normalizedTags.Any(tag => tag.Length > 40))
            errors["tags"] = ["Each tag cannot exceed 40 characters."];

        return errors;
    }

    private static string[] NormalizeTags(IEnumerable<string>? tags)
    {
        if (tags is null)
            return [];

        return tags
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Select(tag => tag.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static ICollection<ProductTag> CreateTags(IEnumerable<string>? tags) =>
        NormalizeTags(tags)
            .Select(tag => new ProductTag
            {
                Name = tag,
                NormalizedName = tag.ToUpperInvariant()
            })
            .ToList();

    private static string? NormalizeDescription(string? description) =>
        string.IsNullOrWhiteSpace(description) ? null : description.Trim();

    private static ProductResponse ToResponse(Product product) =>
        new(
            product.Id,
            product.Name,
            product.Description,
            product.Price,
            product.IsActive,
            product.CreatedAtUtc,
            product.QuantityOnHand,
            product.ImageKey is not null
        );

    private static string? DetectImageType(byte[] data)
    {
        if (data.Length >= 8 &&
            data.AsSpan(0, 8).SequenceEqual(new byte[]
                { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return "image/png";

        if (data.Length >= 3 &&
            data[0] == 0xFF &&
            data[1] == 0xD8 &&
            data[2] == 0xFF)
            return "image/jpeg";

        if (data.Length >= 12 &&
            data[0] == (byte)'R' &&
            data[1] == (byte)'I' &&
            data[2] == (byte)'F' &&
            data[3] == (byte)'F' &&
            data[8] == (byte)'W' &&
            data[9] == (byte)'E' &&
            data[10] == (byte)'B' &&
            data[11] == (byte)'P')
            return "image/webp";

        return null;
    }
}
