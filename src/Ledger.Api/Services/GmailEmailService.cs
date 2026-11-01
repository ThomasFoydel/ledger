using System.Net.Http.Json;
using System.Text.Json;

namespace Ledger.Api.Services;

public sealed class GmailEmailService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<GmailEmailService> logger)
{
    public async Task<bool> SendShipmentNotificationAsync(
        string recipient,
        string orderId,
        int parcelNumber,
        string trackingNumber,
        string? trackingUrl,
        CancellationToken ct)
    {
        var url = configuration["Email:AppsScriptUrl"];
        var secret = configuration["Email:AppsScriptSecret"];

        if (string.IsNullOrWhiteSpace(url) ||
            string.IsNullOrWhiteSpace(secret))
        {
            logger.LogError("Apps Script email settings are missing.");
            return false;
        }

        try
        {
            using var response = await httpClient.PostAsJsonAsync(
                url,
                new
                {
                    secret,
                    recipient,
                    orderId,
                    parcelNumber,
                    trackingNumber,
                    trackingUrl
                },
                ct);

            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Apps Script email request failed with HTTP {StatusCode}: {Response}",
                    (int)response.StatusCode,
                    responseBody);

                return false;
            }

            using var json = JsonDocument.Parse(responseBody);

            var success = json.RootElement.TryGetProperty(
                "success",
                out var successElement) &&
                successElement.GetBoolean();

            if (!success)
            {
                var error = json.RootElement.TryGetProperty(
                    "error",
                    out var errorElement)
                    ? errorElement.GetString()
                    : "Unknown Apps Script error.";

                logger.LogError(
                    "Apps Script could not send shipment notification for order {OrderId}: {Error}",
                    orderId,
                    error);

                return false;
            }

            logger.LogInformation(
                "Shipment notification accepted by Apps Script for order {OrderId}.",
                orderId);

            return true;
        }
        catch (Exception exception) when (
            exception is HttpRequestException or
            TaskCanceledException or
            JsonException)
        {
            logger.LogError(
                exception,
                "Apps Script shipment notification request failed for order {OrderId}.",
                orderId);

            return false;
        }
    }
}
