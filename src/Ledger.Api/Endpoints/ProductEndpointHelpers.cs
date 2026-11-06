using Ledger.Api.Models;

namespace Ledger.Api.Endpoints;

internal static class ProductEndpointHelpers
{
    internal static Dictionary<string, string[]> Validate(
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

    internal static string[] NormalizeTags(IEnumerable<string>? tags)
    {
        if (tags is null)
            return [];

        return tags
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Select(tag => tag.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    internal static ICollection<ProductTag> CreateTags(
        IEnumerable<string>? tags) =>
        NormalizeTags(tags)
            .Select(tag => new ProductTag
            {
                Name = tag,
                NormalizedName = tag.ToUpperInvariant()
            })
            .ToList();

    internal static string? NormalizeDescription(string? description) =>
        string.IsNullOrWhiteSpace(description) ? null : description.Trim();

    internal static ProductResponse ToResponse(Product product) =>
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
}
