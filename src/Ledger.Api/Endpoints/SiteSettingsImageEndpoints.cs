using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class SiteSettingsImageEndpoints
{
    private const string LogoPath = "/api/site-settings/logo";
    private const string FaviconPath = "/api/site-settings/favicon";
    private const string LogoKey = "site/logo.png";
    private const string FaviconKey = "site/favicon.png";

    public static IEndpointRouteBuilder MapSiteSettingsImageEndpoints(
        this IEndpointRouteBuilder app)
    {
        app.MapGet("/site-settings/logo", async (
            HttpContext http,
            LedgerDbContext db,
            NeonObjectStorage storage,
            CancellationToken ct) =>
            await GetImageAsync(http, db, storage, false, ct));

        app.MapGet("/site-settings/favicon", async (
            HttpContext http,
            LedgerDbContext db,
            NeonObjectStorage storage,
            CancellationToken ct) =>
            await GetImageAsync(http, db, storage, true, ct));

        app.MapPost("/site-settings/logo", async (
            HttpContext http,
            IFormFile file,
            LedgerDbContext db,
            NeonObjectStorage storage,
            IAntiforgery antiforgery,
            CancellationToken ct) =>
            await UploadImageAsync(http, file, db, storage, antiforgery, false, ct))
            .RequireAuthorization("OwnerOnly")
            .DisableAntiforgery();

        app.MapPost("/site-settings/favicon", async (
            HttpContext http,
            IFormFile file,
            LedgerDbContext db,
            NeonObjectStorage storage,
            IAntiforgery antiforgery,
            CancellationToken ct) =>
            await UploadImageAsync(http, file, db, storage, antiforgery, true, ct))
            .RequireAuthorization("OwnerOnly")
            .DisableAntiforgery();

        app.MapDelete("/site-settings/logo", async (
            HttpContext http,
            LedgerDbContext db,
            NeonObjectStorage storage,
            IAntiforgery antiforgery,
            CancellationToken ct) =>
            await DeleteImageAsync(http, db, storage, antiforgery, false, ct))
            .RequireAuthorization("OwnerOnly");

        app.MapDelete("/site-settings/favicon", async (
            HttpContext http,
            LedgerDbContext db,
            NeonObjectStorage storage,
            IAntiforgery antiforgery,
            CancellationToken ct) =>
            await DeleteImageAsync(http, db, storage, antiforgery, true, ct))
            .RequireAuthorization("OwnerOnly");

        return app;
    }

    private static async Task<IResult> GetImageAsync(
        HttpContext http,
        LedgerDbContext db,
        NeonObjectStorage storage,
        bool favicon,
        CancellationToken ct)
    {
        var settings = await db.SiteSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == 1, ct);

        var key = favicon ? FaviconKey : LogoKey;
        var storedImage = await storage.GetAsync(key, ct);

        byte[]? data;
        string? contentType;

        if (storedImage is not null)
        {
            data = storedImage.Value.Data;
            contentType = storedImage.Value.ContentType;
        }
        else
        {
            // Temporary fallback while migrating away from database image columns.
            data = favicon ? settings?.FaviconData : settings?.LogoData;
            contentType = favicon
                ? settings?.FaviconContentType
                : settings?.LogoContentType;
        }

        if (data is null || string.IsNullOrWhiteSpace(contentType))
            return Results.NotFound();

        http.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        return Results.File(data, contentType);
    }

    private static async Task<IResult> UploadImageAsync(
        HttpContext http,
        IFormFile file,
        LedgerDbContext db,
        NeonObjectStorage storage,
        IAntiforgery antiforgery,
        bool favicon,
        CancellationToken ct)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(http);
        }
        catch (AntiforgeryValidationException)
        {
            return Results.BadRequest(new { error = "Invalid CSRF token." });
        }

        if (file.Length is <= 0 or > ImageValidation.MaxImageBytes)
            return Results.BadRequest(new { error = "Choose an image smaller than 2 MB." });

        await using var input = file.OpenReadStream();
        using var output = new MemoryStream();
        await input.CopyToAsync(output, ct);
        var data = output.ToArray();
        var contentType = ImageValidation.DetectImageType(data);

        if (contentType is null)
            return Results.BadRequest(new
            {
                error = "Use a valid PNG, JPEG, or WebP image."
            });

        var key = favicon ? FaviconKey : LogoKey;
        var url = favicon ? FaviconPath : LogoPath;

        // Store the object first. Preserve the existing database copy until
        // the object upload succeeds and the metadata update is saved.
        await storage.PutAsync(key, data, contentType, ct);

        var settings = await SiteSettingsData.GetOrCreateAsync(db, ct);

        if (favicon)
        {
            settings.FaviconContentType = contentType;
            settings.FaviconUrl = url;
            settings.FaviconData = null;
        }
        else
        {
            settings.LogoContentType = contentType;
            settings.LogoUrl = url;
            settings.LogoData = null;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(settings);
    }

    private static async Task<IResult> DeleteImageAsync(
        HttpContext http,
        LedgerDbContext db,
        NeonObjectStorage storage,
        IAntiforgery antiforgery,
        bool favicon,
        CancellationToken ct)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(http);
        }
        catch (AntiforgeryValidationException)
        {
            return Results.BadRequest(new { error = "Invalid CSRF token." });
        }

        var settings = await SiteSettingsData.GetOrCreateAsync(db, ct);
        var key = favicon ? FaviconKey : LogoKey;

        await storage.DeleteAsync(key, ct);

        if (favicon)
        {
            settings.FaviconData = null;
            settings.FaviconContentType = null;
            settings.FaviconUrl = null;
        }
        else
        {
            settings.LogoData = null;
            settings.LogoContentType = null;
            settings.LogoUrl = null;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(settings);
    }



}
