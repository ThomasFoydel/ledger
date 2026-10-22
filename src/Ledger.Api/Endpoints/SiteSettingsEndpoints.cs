using Ledger.Api.Data;
using Ledger.Api.Models;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

public static class SiteSettingsEndpoints
{
    private const long MaxImageBytes = 2 * 1024 * 1024;
    private const string LogoPath = "/api/site-settings/logo";
    private const string FaviconPath = "/api/site-settings/favicon";
    private const string LogoKey = "site/logo.png";
    private const string FaviconKey = "site/favicon.png";

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

        if (file.Length is <= 0 or > MaxImageBytes)
            return Results.BadRequest(new { error = "Choose an image smaller than 2 MB." });

        await using var input = file.OpenReadStream();
        using var output = new MemoryStream();
        await input.CopyToAsync(output, ct);
        var data = output.ToArray();
        var contentType = DetectImageType(data);

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

        var settings = await GetOrCreateAsync(db, ct);

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

        var settings = await GetOrCreateAsync(db, ct);
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

    private static string? DetectImageType(byte[] data)
    {
        if (data.Length >= 8 &&
            data.AsSpan(0, 8).SequenceEqual(new byte[]
                { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return "image/png";

        if (data.Length >= 3 &&
            data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
            return "image/jpeg";

        if (data.Length >= 12 &&
            data[0] == (byte)'R' && data[1] == (byte)'I' &&
            data[2] == (byte)'F' && data[3] == (byte)'F' &&
            data[8] == (byte)'W' && data[9] == (byte)'E' &&
            data[10] == (byte)'B' && data[11] == (byte)'P')
            return "image/webp";

        return null;
    }

    private static async Task<SiteSettings> GetOrCreateAsync(
        LedgerDbContext db, CancellationToken ct)
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
