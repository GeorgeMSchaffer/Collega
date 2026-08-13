using Collega.Application.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Processing;

namespace Collega.Infrastructure.Imaging;

/// <summary>
/// ImageSharp-backed <see cref="IImageProcessor"/>. Decodes the raw upload through a real codec, which
/// is the security check: a payload that isn't a genuine GIF/JPEG/PNG (a renamed text file, an
/// executable, a truncated/forged header) fails to decode and returns <c>null</c> — extension and
/// declared MIME type are never trusted. Valid images are downscaled to fit the requested box
/// (aspect preserved, never upscaled) and re-encoded as a fresh PNG, so no original file bytes are
/// persisted verbatim.
/// </summary>
/// <remarks>
/// ImageSharp is fully managed and ships no native binaries, which is why it replaced SkiaSharp: the
/// SkiaSharp package carries native assets for Windows and macOS only, so portrait upload threw
/// <c>DllNotFoundException</c> on Linux App Service while every test stayed green.
/// </remarks>
public sealed class ImageSharpImageProcessor : IImageProcessor
{
    /// <summary>
    /// Only the first frame is ever needed — the output is a single-frame PNG — so refusing to
    /// decode the rest bounds the work an animated GIF can force this path to do.
    /// </summary>
    private static readonly DecoderOptions SingleFrame = new() { MaxFrames = 1 };

    public byte[]? TryCreatePngThumbnail(byte[] input, int maxDimension)
    {
        if (input is null || input.Length == 0 || maxDimension <= 0)
        {
            return null;
        }

        try
        {
            using var source = new MemoryStream(input, writable: false);

            // Confirm the bytes are one of the accepted raster formats before decoding pixels.
            var info = Image.Identify(source);
            if (!IsSupported(info.Metadata.DecodedImageFormat))
            {
                return null;
            }

            source.Position = 0;
            using var image = Image.Load(SingleFrame, source);
            if (image.Width <= 0 || image.Height <= 0)
            {
                return null;
            }

            var scale = Math.Min(1.0, maxDimension / (double)Math.Max(image.Width, image.Height));
            if (scale < 1.0)
            {
                var targetWidth = Math.Max(1, (int)Math.Round(image.Width * scale));
                var targetHeight = Math.Max(1, (int)Math.Round(image.Height * scale));
                image.Mutate(x => x.Resize(targetWidth, targetHeight));
            }

            using var output = new MemoryStream();
            image.SaveAsPng(output);
            return output.ToArray();
        }
        catch (ImageFormatException)
        {
            // Not a decodable image, or not one this build can read — same answer either way.
            return null;
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }

    private static bool IsSupported(IImageFormat? format) =>
        format is GifFormat or JpegFormat or PngFormat;
}
