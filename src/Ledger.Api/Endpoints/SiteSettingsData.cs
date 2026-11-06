using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Endpoints;

internal static class SiteSettingsData
{
    internal static async Task<SiteSettings> GetOrCreateAsync(
        LedgerDbContext db,
        CancellationToken ct)
    {
        var settings = await db.SiteSettings.FirstOrDefaultAsync(x => x.Id == 1, ct);
        if (settings is not null)
            return settings;

        settings = new SiteSettings();
        db.SiteSettings.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }
}
