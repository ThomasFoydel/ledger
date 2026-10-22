using System.Text.Json.Serialization;

namespace Ledger.Api.Models;

public class SiteSettings
{
    public int Id { get; set; } = 1;
    public string PageTitle { get; set; } = "Ledger";
    public string HeaderText { get; set; } = "Ledger";
    public string HeroTitle { get; set; } = "Find something\nworth keeping.";
    public string HeroDescription { get; set; } = "Browse our collection and find just what you’re looking for.";
    public string FooterText { get; set; } = "Thoughtfully managed. Simply shopped.";
    public string? LogoUrl { get; set; }
    public string? LogoContentType { get; set; }

    [JsonIgnore]
    public byte[]? LogoData { get; set; }

    public string? FaviconUrl { get; set; }
    public string? FaviconContentType { get; set; }

    [JsonIgnore]
    public byte[]? FaviconData { get; set; }
}
