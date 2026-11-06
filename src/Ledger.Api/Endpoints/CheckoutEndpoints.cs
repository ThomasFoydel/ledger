namespace Ledger.Api.Endpoints;

public static class CheckoutEndpoints
{
    public static IEndpointRouteBuilder MapCheckoutEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapCheckoutSessionEndpoints();
        app.MapCheckoutStatusEndpoints();
        app.MapStripeWebhookEndpoints();

        return app;
    }
}
