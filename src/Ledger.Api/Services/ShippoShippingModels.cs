namespace Ledger.Api.Services;

public sealed record ShippingAddress(
    string Name,
    string Street1,
    string? Street2,
    string City,
    string State,
    string PostalCode,
    string Country);

public sealed record ShippoParcelRate(
    int ParcelIndex,
    string RateId,
    string Provider,
    string ServiceToken,
    string ServiceName,
    decimal Amount,
    string Currency);

public sealed record ValidatedShippoRate(
    string RateId,
    string Provider,
    string ServiceToken,
    string ServiceName,
    decimal Amount,
    string Currency);

public sealed class InvalidShippingRateException(string message)
    : Exception(message);
