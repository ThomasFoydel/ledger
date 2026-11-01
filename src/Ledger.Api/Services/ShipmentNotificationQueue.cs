using System.Threading.Channels;

namespace Ledger.Api.Services;

public sealed record ShipmentNotification(
    string Recipient,
    string OrderId,
    int ParcelNumber,
    string TrackingNumber,
    string? TrackingUrl);

public sealed class ShipmentNotificationQueue(
    IServiceScopeFactory scopeFactory,
    ILogger<ShipmentNotificationQueue> logger)
    : BackgroundService
{
    private readonly Channel<ShipmentNotification> _queue =
        Channel.CreateBounded<ShipmentNotification>(
            new BoundedChannelOptions(500)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            });

    public bool TryQueue(ShipmentNotification notification)
    {
        return _queue.Writer.TryWrite(notification);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var notification in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var emailService = scope.ServiceProvider
                    .GetRequiredService<GmailEmailService>();

                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
                    stoppingToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(30));

                var sent = await emailService.SendShipmentNotificationAsync(
                    notification.Recipient,
                    notification.OrderId,
                    notification.ParcelNumber,
                    notification.TrackingNumber,
                    notification.TrackingUrl,
                    timeout.Token);

                if (sent)
                {
                    logger.LogInformation(
                        "Shipment notification sent for order {OrderId}.",
                        notification.OrderId);
                }
                else
                {
                    logger.LogWarning(
                        "Shipment notification could not be sent for order {OrderId}.",
                        notification.OrderId);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Background shipment notification failed for order {OrderId}.",
                    notification.OrderId);
            }
        }
    }
}
