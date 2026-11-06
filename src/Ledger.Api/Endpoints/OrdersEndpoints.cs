namespace Ledger.Api.Endpoints;

public static class OrdersEndpoints
{
    public static IEndpointRouteBuilder MapOrdersEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapCustomerOrderEndpoints();
        app.MapAdminOrderEndpoints();

        return app;
    }
}