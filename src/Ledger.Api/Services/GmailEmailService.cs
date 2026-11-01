using System.Net;
using System.Net.Mail;
using System.Text.Encodings.Web;

namespace Ledger.Api.Services;

public sealed class GmailEmailService(
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
        var host = configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
        var port = configuration.GetValue<int?>("Email:SmtpPort") ?? 587;
        var username = configuration["Email:Username"];
        var password = configuration["Email:Password"];
        var fromAddress = configuration["Email:FromAddress"];
        var fromName = configuration["Email:FromName"] ?? "Pax Romana";

        if (string.IsNullOrWhiteSpace(username) ||
            string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(fromAddress))
        {
            logger.LogWarning(
                "Shipment notification was not sent because Gmail SMTP settings are missing.");
            return false;
        }

        var safeOrderId = HtmlEncoder.Default.Encode(orderId);
        var safeTrackingNumber = HtmlEncoder.Default.Encode(trackingNumber);
        var safeTrackingUrl = string.IsNullOrWhiteSpace(trackingUrl)
            ? null
            : HtmlEncoder.Default.Encode(trackingUrl);

        var trackingHtml = safeTrackingUrl is null
            ? safeTrackingNumber
            : $"<a href=\"{safeTrackingUrl}\">{safeTrackingNumber}</a>";

        var html = $"""
            <p>Your Pax Romana order has shipped.</p>
            <p><strong>Order:</strong> {safeOrderId}</p>
            <p><strong>Parcel:</strong> {parcelNumber}</p>
            <p><strong>Tracking number:</strong> {trackingHtml}</p>
            <p>Thank you for your order!</p>
            """;

        var text = $"""
            Your Pax Romana order has shipped.

            Order: {orderId}
            Parcel: {parcelNumber}
            Tracking number: {trackingNumber}
            {(string.IsNullOrWhiteSpace(trackingUrl) ? "" : $"Track your parcel: {trackingUrl}")}

            Thank you for your order!
            """;

        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress, fromName),
                Subject = "Your Pax Romana order has shipped",
                Body = text,
                IsBodyHtml = false
            };

            message.To.Add(recipient);
            message.AlternateViews.Add(
                AlternateView.CreateAlternateViewFromString(
                    html,
                    null,
                    "text/html"));

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = true,
                DeliveryMethod = SmtpDeliveryMethod.Network
            };

            await client.SendMailAsync(message, ct);
            return true;
        }
        catch (Exception exception) when (
            exception is SmtpException or
            InvalidOperationException or
            FormatException)
        {
            logger.LogError(
                exception,
                "Unable to send shipment notification for order {OrderId}.",
                orderId);
            return false;
        }
    }
}
