using System.Globalization;
using System.Text.Json;

namespace Ledger.Api.Services;

internal static class ShippoRateValidator
{
    internal static bool AddressMatches(
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

    internal static bool OriginMatches(
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

    internal static bool ParcelMatches(
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

    internal static bool DecimalMatches(string value, decimal expected)
    {
        return decimal.TryParse(
                   value,
                   NumberStyles.Number,
                   CultureInfo.InvariantCulture,
                   out var actual) &&
               actual == expected;
    }

    internal static bool Same(string? actual, string? expected)
    {
        return string.Equals(
            (actual ?? "").Trim(),
            (expected ?? "").Trim(),
            StringComparison.OrdinalIgnoreCase);
    }

    internal static bool IsAllowedService(string token)
    {
        return token is "usps_ground_advantage" or "usps_priority";
    }

    internal static string GetString(
        JsonElement element,
        string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
            return "";

        return value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : value.ToString();
    }}
