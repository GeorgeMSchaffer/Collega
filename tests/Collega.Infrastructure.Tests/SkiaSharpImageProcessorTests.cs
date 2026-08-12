using System.Text;
using Collega.Infrastructure.Imaging;
using SkiaSharp;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// Content-validation + resize behavior for the profile-portrait pipeline. These run against the
/// real SkiaSharp codec (no DB, no network — hermetic) because the whole point of the feature is
/// that validity is decided by decoding actual bytes, which a fake could not prove.
/// </summary>
public sealed class SkiaSharpImageProcessorTests
{
    private readonly SkiaSharpImageProcessor _sut = new();

    /// <summary>
    /// A real 1x1 GIF89a. Skia ships no GIF *encoder* — only a decoder — so a GIF fixture cannot be
    /// produced by <see cref="EncodeImage"/> and has to be a literal. Kept minimal on purpose: its job
    /// is to prove GIF input decodes and is accepted, not to exercise the resize math (PNG/JPEG cover
    /// that).
    /// </summary>
    private static readonly byte[] OnePixelGif =
    {
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61,             // "GIF89a"
        0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,       // 1x1, global color table, 2 entries
        0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF,             // palette: black, white
        0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, // graphic control extension
        0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
        0x02, 0x02, 0x44, 0x01, 0x00,                   // LZW-compressed single pixel
        0x3B,                                           // trailer
    };

    private static byte[] EncodeImage(int width, int height, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.CornflowerBlue);
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 100);

        // Skia returns null rather than throwing for a format it cannot encode (GIF, notably). Fail
        // with the format named instead of letting a NullReferenceException surface from ToArray().
        Assert.NotNull(data);
        return data!.ToArray();
    }

    [Theory]
    [InlineData(SKEncodedImageFormat.Png)]
    [InlineData(SKEncodedImageFormat.Jpeg)]
    public void TryCreatePngThumbnail_WithLargeSupportedImage_ResizesToFitMaxDimension(SKEncodedImageFormat format)
    {
        var input = EncodeImage(200, 120, format);

        var result = _sut.TryCreatePngThumbnail(input, 25);

        Assert.NotNull(result);
        using var decoded = SKBitmap.Decode(result);
        Assert.NotNull(decoded);
        Assert.True(decoded!.Width <= 25, $"width was {decoded.Width}");
        Assert.True(decoded.Height <= 25, $"height was {decoded.Height}");
        // Aspect ratio (200x120) preserved: the long side hits the 25px cap.
        Assert.Equal(25, decoded.Width);
        Assert.Equal(15, decoded.Height);
    }

    [Fact]
    public void TryCreatePngThumbnail_WithGifInput_IsAcceptedAndReEncodedAsPng()
    {
        // GIF is one of the three accepted upload formats, so a real GIF must survive the codec check
        // and come back out as PNG.
        var result = _sut.TryCreatePngThumbnail(OnePixelGif, 25);

        Assert.NotNull(result);
        using var codec = SKCodec.Create(new MemoryStream(result!));
        Assert.Equal(SKEncodedImageFormat.Png, codec.EncodedFormat);
    }

    [Fact]
    public void TryCreatePngThumbnail_AlwaysReEncodesAsPng()
    {
        var jpeg = EncodeImage(40, 40, SKEncodedImageFormat.Jpeg);

        var result = _sut.TryCreatePngThumbnail(jpeg, 25);

        Assert.NotNull(result);
        using var codec = SKCodec.Create(new MemoryStream(result!));
        Assert.Equal(SKEncodedImageFormat.Png, codec.EncodedFormat);
    }

    [Fact]
    public void TryCreatePngThumbnail_DoesNotUpscaleSmallImage()
    {
        var input = EncodeImage(10, 8, SKEncodedImageFormat.Png);

        var result = _sut.TryCreatePngThumbnail(input, 25);

        Assert.NotNull(result);
        using var decoded = SKBitmap.Decode(result);
        Assert.Equal(10, decoded!.Width);
        Assert.Equal(8, decoded.Height);
    }

    [Fact]
    public void TryCreatePngThumbnail_WithDisguisedTextPayload_IsRejected()
    {
        // A malicious/non-image payload that merely claims to be a PNG by name/MIME upstream. The
        // codec can't decode it, so it must come back null — never persisted as a portrait.
        var fakePng = Encoding.UTF8.GetBytes("This is not an image. <script>alert('x')</script>");

        var result = _sut.TryCreatePngThumbnail(fakePng, 25);

        Assert.Null(result);
    }

    [Fact]
    public void TryCreatePngThumbnail_WithTruncatedPngHeader_IsRejected()
    {
        // Valid PNG magic bytes followed by garbage — decode fails, so it's rejected.
        var truncated = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01, 0x02, 0x03 };

        var result = _sut.TryCreatePngThumbnail(truncated, 25);

        Assert.Null(result);
    }

    [Fact]
    public void TryCreatePngThumbnail_WithEmptyInput_IsRejected()
    {
        Assert.Null(_sut.TryCreatePngThumbnail(Array.Empty<byte>(), 25));
    }
}
