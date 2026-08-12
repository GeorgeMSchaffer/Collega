namespace Collega.Application.Abstractions;

/// <summary>
/// Decodes and re-encodes user-supplied image uploads. Implemented in Infrastructure (SkiaSharp) so
/// the Application layer stays free of any imaging dependency. The contract is deliberately
/// content-first: the implementation must decode the raw bytes through a real image codec and reject
/// anything that isn't a genuine raster image, rather than trusting a file extension or declared
/// MIME type. This is the security boundary for the profile-portrait feature — a text/exe payload
/// renamed to <c>.png</c> must come back as <c>null</c>.
/// </summary>
public interface IImageProcessor
{
    /// <summary>
    /// Validates <paramref name="input"/> as a supported raster image (GIF, JPEG, or PNG), then
    /// produces a square-fitting PNG thumbnail no larger than <paramref name="maxDimension"/> pixels
    /// on either side (aspect ratio preserved; never upscaled). Returns <c>null</c> when the input
    /// is empty, not a decodable image, or not one of the supported formats.
    /// </summary>
    byte[]? TryCreatePngThumbnail(byte[] input, int maxDimension);
}
