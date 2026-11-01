namespace Ledger.Api.Services;

public sealed record ShippingParcel(
    decimal Length,
    decimal Width,
    decimal Height,
    decimal WeightOunces);

public static class ShippingPackageCalculator
{
    private const int MaxBarsPerOrder = 500;
    private const int MaxBarsPerParcel = 10;

    public static IReadOnlyList<ShippingParcel> Calculate(int barCount)
    {
        if (barCount is < 1 or > MaxBarsPerOrder)
        {
            throw new ArgumentOutOfRangeException(
                nameof(barCount),
                $"Shipping estimates support 1–{MaxBarsPerOrder} bars.");
        }

        var parcels = new List<ShippingParcel>();
        var remainingBars = barCount;

        while (remainingBars > 0)
        {
            var barsInParcel = Math.Min(remainingBars, MaxBarsPerParcel);
            parcels.Add(CreateParcel(barsInParcel));
            remainingBars -= barsInParcel;
        }

        return parcels;
    }

    private static ShippingParcel CreateParcel(int barCount)
    {
        // Each bar is estimated at 5 oz.
        // Packaging weight is added separately.
        return barCount switch
        {
            1 => new(4, 3, 2, 6),
            2 => new(6, 4, 3, 12),
            3 => new(6, 4, 3, 17),
            4 => new(8, 6, 4, 23),
            5 => new(8, 6, 4, 28),
            6 => new(8, 6, 4, 33),
            7 => new(10, 8, 5, 38),
            8 => new(10, 8, 5, 43),
            9 => new(10, 8, 5, 48),
            10 => new(10, 8, 5, 53),
            _ => throw new InvalidOperationException(
                "Unexpected parcel size.")
        };
    }
}
