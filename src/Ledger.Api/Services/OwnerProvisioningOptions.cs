namespace Ledger.Api.Services;

public sealed class OwnerProvisioningOptions
{
    public bool Enabled { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; }
}