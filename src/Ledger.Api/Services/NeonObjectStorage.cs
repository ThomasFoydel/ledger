using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace Ledger.Api.Services;

public sealed class NeonObjectStorage : IDisposable
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;

    public NeonObjectStorage(IConfiguration configuration)
    {
        var endpoint = configuration["AWS_ENDPOINT_URL_S3"]
            ?? throw new InvalidOperationException("Object storage endpoint is not configured.");
        var region = configuration["AWS_REGION"]
            ?? throw new InvalidOperationException("Object storage region is not configured.");
        var accessKey = configuration["AWS_ACCESS_KEY_ID"]
            ?? throw new InvalidOperationException("Object storage access key is not configured.");
        var secretKey = configuration["AWS_SECRET_ACCESS_KEY"]
            ?? throw new InvalidOperationException("Object storage secret key is not configured.");

        _bucket = configuration["OBJECT_STORAGE_BUCKET"] ?? "ledgerstorage";

        _client = new AmazonS3Client(
            new BasicAWSCredentials(accessKey, secretKey),
            new AmazonS3Config
            {
                ServiceURL = endpoint,
                AuthenticationRegion = region,
                ForcePathStyle = true
            });
    }

    public async Task PutAsync(
        string key, byte[] data, string contentType, CancellationToken ct)
    {
        await using var stream = new MemoryStream(data);

        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType
        }, ct);
    }

    public async Task<(byte[] Data, string ContentType)?> GetAsync(
        string key, CancellationToken ct)
    {
        try
        {
            using var response = await _client.GetObjectAsync(
                new GetObjectRequest
                {
                    BucketName = _bucket,
                    Key = key
                }, ct);

            await using var stream = new MemoryStream();
            await response.ResponseStream.CopyToAsync(stream, ct);

            return (stream.ToArray(), response.Headers.ContentType);
        }
        catch (AmazonS3Exception ex) when (
            ex.StatusCode == System.Net.HttpStatusCode.NotFound ||
            ex.ErrorCode == "NoSuchKey")
        {
            return null;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct)
    {
        await _client.DeleteObjectAsync(new DeleteObjectRequest
        {
            BucketName = _bucket,
            Key = key
        }, ct);
    }

    public void Dispose() => _client.Dispose();
}
