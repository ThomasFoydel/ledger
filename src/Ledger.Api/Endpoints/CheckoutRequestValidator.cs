using System.Text.RegularExpressions;
using Ledger.Api.Services;

namespace Ledger.Api.Endpoints;

internal static class CheckoutRequestValidator
{
    internal static string? Validate(
        CheckoutSessionEndpoints.CheckoutRequest request)
    {
        if (request.Items is null ||
            request.Items.Count is 0 or > 50 ||
            request.Items.Any(item =>
                item.ProductId == Guid.Empty ||
                item.Quantity is < 1 or > 500) ||
            request.Items.Select(item => item.ProductId).Distinct().Count()
                != request.Items.Count)
        {
            return "Provide 1–50 distinct products with valid quantities.";
        }

        var destination = request.Destination;

        if (destination is null ||
            string.IsNullOrWhiteSpace(destination.Name) ||
            string.IsNullOrWhiteSpace(destination.Street1) ||
            string.IsNullOrWhiteSpace(destination.City) ||
            string.IsNullOrWhiteSpace(destination.State) ||
            string.IsNullOrWhiteSpace(destination.PostalCode) ||
            !Regex.IsMatch(destination.PostalCode, @"^\d{5}(-\d{4})?$") ||
            !string.Equals(
                destination.Country, "US",
                StringComparison.OrdinalIgnoreCase))
        {
            return "Provide a valid US shipping address.";
        }

        if (destination.Name.Length > 100 ||
            destination.Street1.Length > 200 ||
            (destination.Street2?.Length ?? 0) > 200 ||
            destination.City.Length > 100 ||
            destination.State.Length > 50)
        {
            return "One or more address fields are too long.";
        }

        if (string.IsNullOrWhiteSpace(request.ShippingServiceToken) ||
            request.ShippingRateIds is null)
        {
            return "Select a shipping service and request shipping rates.";
        }

        return null;
    }

    internal static ShippingAddress CreateShippingAddress(
        CheckoutSessionEndpoints.CheckoutDestinationRequest destination)
    {
        return new ShippingAddress(
            destination.Name.Trim(),
            destination.Street1.Trim(),
            string.IsNullOrWhiteSpace(destination.Street2)
                ? null
                : destination.Street2.Trim(),
            destination.City.Trim(),
            destination.State.Trim(),
            destination.PostalCode.Trim(),
            "US");
    }
}
