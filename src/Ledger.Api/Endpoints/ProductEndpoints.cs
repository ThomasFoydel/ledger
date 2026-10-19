using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/products", async (LedgerDbContext db, CancellationToken ct) =>
        {
            var products = await db.Products
                .AsNoTracking()
                .Where(product => product.IsActive)
                .OrderBy(product => product.Name)
                .Select(product => new ProductResponse(
                    product.Id,
                    product.Name,
                    product.Description,
                    product.Price,
                    product.IsActive,
                    product.CreatedAtUtc,
                    product.QuantityOnHand
                ))
                .ToListAsync(ct);

            return Results.Ok(products);
        });

        app.MapGet("/products/{id:guid}", async (Guid id, LedgerDbContext db, CancellationToken ct) =>
        {
            var product = await db.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(product => product.Id == id && product.IsActive, ct);

            return product is null
                ? Results.NotFound()
                : Results.Ok(ToResponse(product));
        })
        .WithName("GetProductById");

        app.MapPost("/products", async (CreateProductRequest request, LedgerDbContext db, CancellationToken ct) =>
        {
            var errors = Validate(request.Name, request.Description, request.Price, request.QuantityOnHand);

            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var product = new Product
            {
                Name = request.Name!.Trim(),
                Description = NormalizeDescription(request.Description),
                Price = request.Price,
                QuantityOnHand = request.QuantityOnHand
            };

            db.Products.Add(product);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/products/{product.Id}", ToResponse(product));
        })
        .RequireAuthorization("OwnerOnly");

        app.MapPut("/products/{id:guid}", async (Guid id, UpdateProductRequest request, LedgerDbContext db, CancellationToken ct) =>
        {
            var errors = Validate(request.Name, request.Description, request.Price, request.QuantityOnHand);

            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var product = await db.Products
                .FirstOrDefaultAsync(product => product.Id == id && product.IsActive, ct);

            if (product is null) return Results.NotFound();

            product.Name = request.Name!.Trim();
            product.Description = NormalizeDescription(request.Description);
            product.Price = request.Price;
            product.QuantityOnHand = request.QuantityOnHand;

            await db.SaveChangesAsync(ct);

            return Results.Ok(ToResponse(product));
        })
        .RequireAuthorization("OwnerOnly");

        app.MapDelete("/products/{id:guid}", async (Guid id, LedgerDbContext db, CancellationToken ct) =>
        {
            var product = await db.Products
                .FirstOrDefaultAsync(product => product.Id == id && product.IsActive, ct);

            if (product is null) return Results.NotFound();

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
        int quantityOnHand)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(name)) errors["name"] = ["Name is required."];
        else if (name.Trim().Length > 200) errors["name"] = ["Name cannot exceed 200 characters."];

        if (description?.Length > 2000) errors["description"] = ["Description cannot exceed 2000 characters."];

        if (price < 0 || price > 99999999.99m) errors["price"] = ["Price must be between 0 and 99999999.99."];

        if (quantityOnHand < 0) errors["quantityOnHand"] = ["Quantity cannot be negative."];

        return errors;
    }

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
            product.QuantityOnHand
        );
}
