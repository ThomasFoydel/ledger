namespace Ledger.Api.Models;

public class SiteSettings
{
    public int Id { get; set; } = 1;
    public string PageTitle { get; set; } = "Ledger";
    public string HeaderText { get; set; } = "Ledger";
    public string HeroTitle { get; set; } = "Find something\nworth keeping.";
    public string HeroDescription { get; set; } = "Browse our collection and find just what you’re looking for.";
    public string FooterText { get; set; } = "Thoughtfully managed. Simply shopped.";
}
