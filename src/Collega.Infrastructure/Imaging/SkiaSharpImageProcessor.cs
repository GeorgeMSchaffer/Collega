using Collega.Application.Abstractions;
using SkiaSharp;

namespace Collega.Infrastructure.Imaging;

/// <summary>
/// SkiaSharp-backed <see cref="IImageProcessor"/>. Decodes the raw upload through Skia's codec, which
/// is the security check: a payload that isn't a real GIF/JPEG/PNG (a renamed text file, an
/// executable, a truncated/forged header) fails to decode and returns <c>null</c> — extension and
/// declared MIME type are never trusted. Valid images are downscaled to fit the requested box
/// (aspect preserved, never upscaled) and re-encoded as a fresh PNG, so no original file bytes are
/// persisted verbatim.
/// </summary>
public sealed class SkiaSharpImageProcessor : IImageProcessor
{
    private static readonly HashSet<SKEncodedImageFormat> SupportedFormats = new()
    {
        SKEncodedImageFormat.Gif,
        SKEncodedImageFormat.Jpeg,
        SKEncodedImageFormat.Png,
    };

    public byte[]? TryCreatePngThumbnail(byte[] input, int maxDimension)
    {
        if (input is null || input.Length == 0 || maxDimension <= 0)
        {
            return null;
        }

        using var data = SKData.CreateCopy(input);

        // Confirm the bytes decode to one of the accepted raster formats before doing any work.
        using (var codec = SKCodec.Create(data))
        {
            if (codec is null || !SupportedFormats.Contains(codec.EncodedFormat))
            {
                return null;
            }
        }

        using var source = SKBitmap.Decode(data);
        if (source is null || source.Width <= 0 || source.Height <= 0)
        {
            return null;
        }

        var scale = Math.Min(1.0, maxDimension / (double)Math.Max(source.Width, source.Height));
        var targetWidth = Math.Max(1, (int)Math.Round(source.Width * scale));
        var targetHeight = Math.Max(1, (int)Math.Round(source.Height * scale));

        var info = new SKImageInfo(targetWidth, targetHeight, SKColorType.Rgba8888, SKAlphaType.Premul);
        using var resized = source.Resize(info, SKFilterQuality.High);
        if (resized is null)
        {
            return null;
        }

        using var image = SKImage.FromBitmap(resized);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
        return encoded?.ToArray();
    }
}
