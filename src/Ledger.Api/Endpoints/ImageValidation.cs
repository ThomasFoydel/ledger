namespace Ledger.Api.Endpoints;

internal static class ImageValidation
{
    internal const long MaxImageBytes = 2 * 1024 * 1024;

    internal static string? DetectImageType(byte[] data)
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
}
