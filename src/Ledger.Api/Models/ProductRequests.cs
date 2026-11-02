namespace Ledger.Api.Models;

public sealed record CreateProductRequest(
    string? Name,
    string? Description,
    decimal Price,
    int QuantityOnHand,
    string[]? Tags = null
);

public sealed record UpdateProductRequest(
    string? Name,
    string? Description,
    decimal Price,
    int QuantityOnHand,
    string[]? Tags = null
);

public sealed record ProductResponse(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    bool IsActive,
    DateTime CreatedAtUtcs,
    int QuantityOnHand,
    bool HasImage
);

public sealed record SetProductVisibilityRequest(bool IsActive);
