namespace Ledger.Api.Models;

public sealed record SiteSettingsRequest(
    string? PageTitle,
    string? HeaderText,
    string? HeroTitle,
    string? HeroDescription,
    string? FooterText
);
