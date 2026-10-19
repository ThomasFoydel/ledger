namespace Ledger.Api.Models;

public sealed record CreateProductRequest(
    string? Name,
    string? Description,
    decimal Price,
    int QuantityOnHand
);

public sealed record UpdateProductRequest(
    string? Name,
    string? Description,
    decimal Price,
    int QuantityOnHand
);

public sealed record ProductResponse(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    bool IsActive,
    DateTime CreatedAtUtcs,
    int QuantityOnHand
);
