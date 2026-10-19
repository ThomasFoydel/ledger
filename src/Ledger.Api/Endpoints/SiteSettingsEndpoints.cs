using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class SiteSettingsEndpoints
{
    public static IEndpointRouteBuilder MapSiteSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/site-settings", async (LedgerDbContext db, CancellationToken ct) =>
        {
            var settings = await GetOrCreateAsync(db, ct);
            return Results.Ok(settings);
        });

        app.MapPut("/site-settings", async (
            SiteSettingsRequest request,
            LedgerDbContext db,
            CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();

            Validate(request.PageTitle, "pageTitle", 200, errors);
            Validate(request.HeaderText, "headerText", 200, errors);
            Validate(request.HeroTitle, "heroTitle", 500, errors);
            Validate(request.HeroDescription, "heroDescription", 2000, errors);
            Validate(request.FooterText, "footerText", 500, errors);

            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var settings = await GetOrCreateAsync(db, ct);
            settings.PageTitle = request.PageTitle!.Trim();
            settings.HeaderText = request.HeaderText!.Trim();
            settings.HeroTitle = request.HeroTitle!.Trim();
            settings.HeroDescription = request.HeroDescription!.Trim();
            settings.FooterText = request.FooterText!.Trim();

            await db.SaveChangesAsync(ct);
            return Results.Ok(settings);
        }).RequireAuthorization("OwnerOnly");

        return app;
    }

    private static async Task<SiteSettings> GetOrCreateAsync(
        LedgerDbContext db,
        CancellationToken ct)
    {
        var settings = await db.SiteSettings.FirstOrDefaultAsync(x => x.Id == 1, ct);
        if (settings is not null) return settings;

        settings = new SiteSettings();
        db.SiteSettings.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }

    private static void Validate(
        string? value,
        string key,
        int maxLength,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
            errors[key] = ["This field is required."];
        else if (value.Trim().Length > maxLength)
            errors[key] = [$"This field cannot exceed {maxLength} characters."];
    }
}
