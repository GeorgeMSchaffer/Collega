using System.Text;
using Collega.Infrastructure.Imaging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// Content-validation + resize behavior for the profile-portrait pipeline. These run against the
/// real ImageSharp codec (no DB, no network — hermetic) because the whole point of the feature is
/// that validity is decided by decoding actual bytes, which a fake could not prove.
/// </summary>
public sealed class ImageSharpImageProcessorTests
{
    private readonly ImageSharpImageProcessor _sut = new();

    /// <summary>
    /// A real 1x1 GIF89a. ImageSharp can encode GIF, so unlike the SkiaSharp implementation this
    /// fixture is no longer strictly required — it is kept because bytes written by hand exercise the
    /// decoder independently, where a round trip through <see cref="EncodeImage"/> could mask a bug
    /// symmetrical across the same library's encoder and decoder.
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

    private static byte[] EncodeImage(int width, int height, string format)
    {
        using var image = new Image<Rgba32>(width, height);
        image.Mutate(x => x.BackgroundColor(Color.CornflowerBlue));

        using var buffer = new MemoryStream();
        switch (format)
        {
            case "png":
                image.Save(buffer, new PngEncoder());
                break;
            case "jpeg":
                image.Save(buffer, new JpegEncoder());
                break;
            case "gif":
                image.Save(buffer, new GifEncoder());
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(format), format, "Unhandled fixture format.");
        }

        return buffer.ToArray();
    }

    private static void AssertIsPng(byte[] bytes)
    {
        using var buffer = new MemoryStream(bytes);
        var info = Image.Identify(buffer);
        Assert.IsType<PngFormat>(info.Metadata.DecodedImageFormat);
    }

    [Theory]
    [InlineData("png")]
    [InlineData("jpeg")]
    [InlineData("gif")]
    public void TryCreatePngThumbnail_WithLargeSupportedImage_ResizesToFitMaxDimension(string format)
    {
        var input = EncodeImage(200, 120, format);

        var result = _sut.TryCreatePngThumbnail(input, 25);

        Assert.NotNull(result);
        using var decoded = Image.Load(result!);
        Assert.True(decoded.Width <= 25, $"width was {decoded.Width}");
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
        AssertIsPng(result!);
    }

    [Fact]
    public void TryCreatePngThumbnail_AlwaysReEncodesAsPng()
    {
        var jpeg = EncodeImage(40, 40, "jpeg");

        var result = _sut.TryCreatePngThumbnail(jpeg, 25);

        Assert.NotNull(result);
        AssertIsPng(result!);
    }

    [Fact]
    public void TryCreatePngThumbnail_DoesNotUpscaleSmallImage()
    {
        var input = EncodeImage(10, 8, "png");

        var result = _sut.TryCreatePngThumbnail(input, 25);

        Assert.NotNull(result);
        using var decoded = Image.Load(result!);
        Assert.Equal(10, decoded.Width);
        Assert.Equal(8, decoded.Height);
    }

    [Fact]
    public void TryCreatePngThumbnail_WithUnsupportedButValidImageFormat_IsRejected()
    {
        // A genuinely decodable image in a format outside the GIF/JPEG/PNG allowlist must still be
        // refused — the allowlist is a policy boundary, not just a decode check.
        using var image = new Image<Rgba32>(20, 20);
        using var buffer = new MemoryStream();
        image.Save(buffer, new SixLabors.ImageSharp.Formats.Bmp.BmpEncoder());

        Assert.Null(_sut.TryCreatePngThumbnail(buffer.ToArray(), 25));
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
