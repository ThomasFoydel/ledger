using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

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

public sealed class ShippoShippingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public ShippoShippingService(
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;

        _httpClient.BaseAddress = new Uri("https://api.goshippo.com/");
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));

        var token = configuration["Shippo:ApiToken"];

        if (!string.IsNullOrWhiteSpace(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("ShippoToken", token);
        }
    }

    public async Task<IReadOnlyList<ShippoParcelRate>> GetRatesAsync(
        ShippingAddress destination,
        IReadOnlyList<ShippingParcel> parcels,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();

        var from = GetOrigin();

        var results = new List<ShippoParcelRate>();

        for (var index = 0; index < parcels.Count; index++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var parcel = parcels[index];

            var request = new
            {
                address_from = from,
                address_to = new
                {
                    name = destination.Name,
                    street1 = destination.Street1,
                    street2 = destination.Street2,
                    city = destination.City,
                    state = destination.State,
                    zip = destination.PostalCode,
                    country = destination.Country
                },
                parcels = new[]
                {
                    new
                    {
                        length = Format(parcel.Length),
                        width = Format(parcel.Width),
                        height = Format(parcel.Height),
                        distance_unit = "in",
                        weight = Format(parcel.WeightOunces),
                        mass_unit = "oz"
                    }
                },
                async = false
            };

            using var response = await _httpClient.PostAsJsonAsync(
                "shipments/",
                request,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException(
                    $"Shippo returned HTTP {(int)response.StatusCode}.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(
                cancellationToken);

            using var document = await JsonDocument.ParseAsync(
                stream,
                cancellationToken: cancellationToken);

            var root = document.RootElement;

            if (!root.TryGetProperty("rates", out var rates) ||
                rates.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException(
                    "Shippo did not return shipping rates.");
            }

            foreach (var rate in rates.EnumerateArray())
            {
                var provider = GetString(rate, "provider");
                var rateId = GetString(rate, "object_id");

                if (!string.Equals(
                    provider, "USPS",
                    StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrWhiteSpace(rateId) ||
                    !rate.TryGetProperty(
                        "servicelevel", out var serviceLevel))
                {
                    continue;
                }

                var serviceToken = GetString(serviceLevel, "token");

                if (!IsAllowedService(serviceToken))
                    continue;

                if (!decimal.TryParse(
                    GetString(rate, "amount"),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var amount))
                {
                    continue;
                }

                results.Add(new ShippoParcelRate(
                    index,
                    rateId,
                    provider,
                    serviceToken,
                    GetString(serviceLevel, "name"),
                    amount,
                    GetString(rate, "currency")));
            }
        }

        return results;
    }

    public async Task<IReadOnlyList<ValidatedShippoRate>> ValidateRatesAsync(
        ShippingAddress destination,
        IReadOnlyList<ShippingParcel> parcels,
        string serviceToken,
        IReadOnlyList<string> rateIds,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();

        if (!IsAllowedService(serviceToken))
        {
            throw new InvalidShippingRateException(
                "The selected shipping service is not supported.");
        }

        if (parcels.Count == 0 ||
            rateIds.Count != parcels.Count ||
            rateIds.Any(string.IsNullOrWhiteSpace) ||
            rateIds.Distinct(StringComparer.Ordinal).Count() != rateIds.Count)
        {
            throw new InvalidShippingRateException(
                "The selected shipping quote is invalid. Please request new rates.");
        }

        var origin = GetOrigin();
        var validatedRates = new List<ValidatedShippoRate>();

        for (var index = 0; index < rateIds.Count; index++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var rateId = rateIds[index];

            using var rateResponse = await _httpClient.GetAsync(
                $"rates/{Uri.EscapeDataString(rateId)}",
                cancellationToken);

            if (!rateResponse.IsSuccessStatusCode)
            {
                throw new InvalidShippingRateException(
                    "A selected shipping rate is no longer available. Please request new rates.");
            }

            await using var rateStream =
                await rateResponse.Content.ReadAsStreamAsync(cancellationToken);

            using var rateDocument = await JsonDocument.ParseAsync(
                rateStream,
                cancellationToken: cancellationToken);

            var rate = rateDocument.RootElement;

            if (!string.Equals(
                    GetString(rate, "object_id"),
                    rateId,
                    StringComparison.Ordinal) ||
                !string.Equals(
                    GetString(rate, "provider"),
                    "USPS",
                    StringComparison.OrdinalIgnoreCase) ||
                !rate.TryGetProperty(
                    "servicelevel", out var serviceLevel) ||
                !string.Equals(
                    GetString(serviceLevel, "token"),
                    serviceToken,
                    StringComparison.Ordinal))
            {
                throw new InvalidShippingRateException(
                    "A selected shipping rate does not match the requested service.");
            }

            var currency = GetString(rate, "currency");

            if (!string.Equals(currency, "USD", StringComparison.OrdinalIgnoreCase) ||
                !decimal.TryParse(
                    GetString(rate, "amount"),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var amount) ||
                amount <= 0)
            {
                throw new InvalidShippingRateException(
                    "A selected shipping rate has an invalid price.");
            }

            var shipmentId = GetString(rate, "shipment");

            if (string.IsNullOrWhiteSpace(shipmentId))
            {
                throw new InvalidShippingRateException(
                    "A selected shipping rate has no associated shipment.");
            }

            using var shipmentResponse = await _httpClient.GetAsync(
                $"shipments/{Uri.EscapeDataString(shipmentId)}",
                cancellationToken);

            if (!shipmentResponse.IsSuccessStatusCode)
            {
                throw new InvalidShippingRateException(
                    "A selected shipping shipment could not be verified. Please request new rates.");
            }

            await using var shipmentStream =
                await shipmentResponse.Content.ReadAsStreamAsync(cancellationToken);

            using var shipmentDocument = await JsonDocument.ParseAsync(
                shipmentStream,
                cancellationToken: cancellationToken);

            var shipment = shipmentDocument.RootElement;

            if (!shipment.TryGetProperty("address_to", out var addressTo) ||
                !AddressMatches(addressTo, destination) ||
                !shipment.TryGetProperty("address_from", out var addressFrom) ||
                !OriginMatches(addressFrom, origin) ||
                !shipment.TryGetProperty("parcels", out var shipmentParcels) ||
                shipmentParcels.ValueKind != JsonValueKind.Array ||
                shipmentParcels.GetArrayLength() != 1 ||
                !ParcelMatches(
                    shipmentParcels[0],
                    parcels[index]))
            {
                throw new InvalidShippingRateException(
                    "A selected shipping rate does not match your address or package. Please request new rates.");
            }

            validatedRates.Add(new ValidatedShippoRate(
                rateId,
                "USPS",
                serviceToken,
                GetString(serviceLevel, "name"),
                amount,
                currency));
        }

        return validatedRates;
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_configuration["Shippo:ApiToken"]))
        {
            throw new InvalidOperationException(
                "Shippo API token is not configured.");
        }
    }

    private object GetOrigin()
    {
        var name = _configuration["Shipping:FromName"];
        var street1 = _configuration["Shipping:FromStreet1"];
        var city = _configuration["Shipping:FromCity"];
        var state = _configuration["Shipping:FromState"];
        var postalCode = _configuration["Shipping:FromPostalCode"];
        var country = _configuration["Shipping:FromCountry"];

        if (string.IsNullOrWhiteSpace(name) ||
            string.IsNullOrWhiteSpace(street1) ||
            string.IsNullOrWhiteSpace(city) ||
            string.IsNullOrWhiteSpace(state) ||
            string.IsNullOrWhiteSpace(postalCode) ||
            string.IsNullOrWhiteSpace(country))
        {
            throw new InvalidOperationException(
                "Shipping origin address is not fully configured.");
        }

        return new
        {
            name,
            street1,
            city,
            state,
            zip = postalCode,
            country
        };
    }

    private static bool AddressMatches(
        JsonElement address,
        ShippingAddress expected)
    {
        return Same(GetString(address, "street1"), expected.Street1) &&
               Same(GetString(address, "street2"), expected.Street2 ?? "") &&
               Same(GetString(address, "city"), expected.City) &&
               Same(GetString(address, "state"), expected.State) &&
               Same(GetString(address, "zip"), expected.PostalCode) &&
               Same(GetString(address, "country"), expected.Country);
    }

    private static bool OriginMatches(
        JsonElement address,
        object expectedOrigin)
    {
        // Compare the shipment against the configured sender address.
        var expected = JsonSerializer.SerializeToElement(expectedOrigin);

        return Same(GetString(address, "name"), GetString(expected, "name")) &&
               Same(GetString(address, "street1"), GetString(expected, "street1")) &&
               Same(GetString(address, "city"), GetString(expected, "city")) &&
               Same(GetString(address, "state"), GetString(expected, "state")) &&
               Same(GetString(address, "zip"), GetString(expected, "zip")) &&
               Same(GetString(address, "country"), GetString(expected, "country"));
    }

    private static bool ParcelMatches(
        JsonElement actual,
        ShippingParcel expected)
    {
        return Same(GetString(actual, "distance_unit"), "in") &&
               Same(GetString(actual, "mass_unit"), "oz") &&
               DecimalMatches(GetString(actual, "length"), expected.Length) &&
               DecimalMatches(GetString(actual, "width"), expected.Width) &&
               DecimalMatches(GetString(actual, "height"), expected.Height) &&
               DecimalMatches(GetString(actual, "weight"), expected.WeightOunces);
    }

    private static bool DecimalMatches(string value, decimal expected)
    {
        return decimal.TryParse(
                   value,
                   NumberStyles.Number,
                   CultureInfo.InvariantCulture,
                   out var actual) &&
               actual == expected;
    }

    private static bool Same(string? actual, string? expected)
    {
        return string.Equals(
            (actual ?? "").Trim(),
            (expected ?? "").Trim(),
            StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsAllowedService(string token)
    {
        return token is "usps_ground_advantage" or "usps_priority";
    }

    private static string Format(decimal value)
    {
        return value.ToString(CultureInfo.InvariantCulture);
    }

    private static string GetString(
        JsonElement element,
        string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
            return "";

        return value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : value.ToString();
    }
}
