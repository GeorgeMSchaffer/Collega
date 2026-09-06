import sharp from 'sharp'

/** Raster formats the portrait pipeline accepts - matches .NET's `ImageSharpImageProcessor`. */
const SUPPORTED_FORMATS = new Set(['gif', 'jpeg', 'png'])

/**
 * Sharp-backed portrait thumbnail pipeline, replacing .NET's ImageSharp-based
 * `ImageSharpImageProcessor`. `sharp` decodes through libvips, a real image codec, which is the
 * security check this exists for: a payload that isn't a genuine GIF/JPEG/PNG (a renamed text
 * file, an executable, a truncated/forged header) fails to decode rather than being trusted by
 * extension or declared MIME type. Valid images are downscaled to fit the requested box (aspect
 * preserved, never upscaled) and re-encoded as a fresh PNG, so no original file bytes are
 * persisted verbatim.
 *
 * Moving off ImageSharp removes a real constraint, not just a rewrite for its own sake: the .NET
 * side was pinned to ImageSharp 3.1.x specifically because 4.x requires a paid licence key, and
 * 3.1.x's own licence is free only below a revenue threshold (SPEC/decisions.md). `sharp` is
 * Apache-2.0/MIT-licensed with no such ceiling.
 *
 * NOTE ON THE PORT SHAPE: `ImageProcessor.tryCreatePngThumbnail`
 * (packages/application/src/auth/ports.ts) is declared SYNCHRONOUS, matching the .NET original's
 * CPU-bound ImageSharp call. `sharp` has no synchronous API - every operation runs off the main
 * thread via a promise, which is a deliberate feature (a large image never blocks the event loop
 * under Node), not a limitation to route around with a blocking wait. This class therefore does
 * NOT literally implement `ImageProcessor` and exposes `tryCreatePngThumbnail` returning a
 * `Promise` instead. REPORTED to Wave B/D: the port's return type needs to become
 * `Promise<Uint8Array | null>` before an infrastructure image processor can be wired to a caller
 * through that interface.
 */
export class SharpImageProcessor {
  async tryCreatePngThumbnail(input: Uint8Array, maxDimension: number): Promise<Uint8Array | null> {
    if (input.length === 0 || maxDimension <= 0) {
      return null
    }

    const box = Math.max(1, Math.round(maxDimension))

    try {
      const image = sharp(Buffer.from(input), { failOn: 'error' })

      const metadata = await image.metadata()
      const { format, width, height } = metadata
      if (format === undefined || !SUPPORTED_FORMATS.has(format)) {
        return null
      }
      if (width === undefined || height === undefined || width <= 0 || height <= 0) {
        return null
      }

      const output = await image
        .resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()

      return new Uint8Array(output)
    } catch {
      // Not a decodable image, or not one of the supported formats - same answer either way.
      return null
    }
  }
}
