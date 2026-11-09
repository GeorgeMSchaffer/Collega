"""Generate public screenshot variants with Pillow; never overwrite source PNGs."""

import hashlib
import json
import math
import re
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile

from PIL import Image, features


ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps" / "public"
HERE = Path(__file__).resolve().parent
WIDTHS = (480, 640, 960, 1280, 1440, 1920)
SOURCES = ("prototype/shots", "worksprint-assets")


def main():
    if not features.check("webp"):
        raise RuntimeError("Pillow must include WebP support.")

    manifest = {}
    with ZipFile(HERE / "originals.zip", "a", compression=ZIP_STORED) as backup:
        entries = set(backup.namelist())
        for folder in SOURCES:
            for source in sorted((PUBLIC / folder).glob("*.png")):
                original = source.read_bytes()
                digest = hashlib.sha256(original).hexdigest()
                relative = source.relative_to(ROOT).as_posix()
                archive_path = relative
                if archive_path in entries and backup.read(archive_path) != original:
                    archive_path = f"revisions/{digest}/{relative}"
                if archive_path not in entries:
                    backup.writestr(archive_path, original)
                    entries.add(archive_path)
                if backup.read(archive_path) != original:
                    raise RuntimeError(f"Backup mismatch: {source}")

                with Image.open(source) as image:
                    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                    width, height = image.size
                    widths = {w for w in WIDTHS if w < width} | {width}
                    if folder == "worksprint-assets":
                        widths |= {w for w in (160, 320) if w < width}
                    output_dir = source.parent / "optimized"
                    output_dir.mkdir(exist_ok=True)
                    variants = []
                    for target_width in sorted(widths):
                        # Round widths to the source ratio's integer unit: no distortion.
                        unit = width // math.gcd(width, height)
                        target_width = max(unit, target_width // unit * unit)
                        size = (target_width, height * target_width // width)
                        resized = image if size == image.size else image.resize(
                            size, Image.Resampling.LANCZOS
                        )
                        output = output_dir / f"{source.stem}-{target_width}.webp"
                        resized.save(output, "WEBP", lossless=True, method=6, exact=True)
                        with Image.open(output) as encoded:
                            if encoded.size != size or encoded.convert(image.mode).tobytes() != resized.tobytes():
                                raise RuntimeError(f"Lossless verification failed: {output}")
                        variants.append({
                            "src": "/" + output.relative_to(PUBLIC).as_posix(),
                            "width": size[0],
                            "height": size[1],
                            "bytes": output.stat().st_size,
                        })
                    efficient = []
                    smallest = math.inf
                    for variant in reversed(variants):
                        if variant["bytes"] < smallest:
                            efficient.append(variant)
                            smallest = variant["bytes"]
                        else:
                            (PUBLIC / variant["src"].lstrip("/")).unlink()
                    manifest["/" + source.relative_to(PUBLIC).as_posix()] = {
                        "width": width,
                        "height": height,
                        "bytes": len(original),
                        "sha256": digest,
                        "backup": archive_path,
                        "variants": list(reversed(efficient)),
                    }

    (HERE / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    prototype_sources = {
        Path(source).stem: ", ".join(
            f"shots/optimized/{Path(variant['src']).name} {variant['width']}w"
            for variant in item["variants"]
        )
        for source, item in manifest.items()
        if source.startswith("/prototype/")
    }
    (PUBLIC / "prototype" / "shots" / "optimized" / "sources.js").write_text(
        "const SCREENSHOT_SOURCES = " + json.dumps(prototype_sources, indent=2) + ";\n",
        encoding="utf-8",
    )
    for page in PUBLIC.rglob("*.html"):
        def srcset(match):
            first = match[2].split()[0]
            asset = PUBLIC / first.lstrip("/") if first.startswith("/") else page.parent / first
            source = asset.parent.parent / re.sub(r"-\d+\.webp$", ".png", asset.name)
            item = manifest["/" + source.resolve().relative_to(PUBLIC).as_posix()]
            prefix = first.rsplit("/", 1)[0]
            candidates = ", ".join(
                f"{prefix}/{Path(variant['src']).name} {variant['width']}w"
                for variant in item["variants"]
                if variant["width"] >= 320
            )
            return match[1] + candidates + match[3]

        original = page.read_text(encoding="utf-8")
        updated = re.sub(r'(<source type="image/webp" srcset=")([^"]+)(")', srcset, original)
        if updated != original:
            page.write_text(updated, encoding="utf-8", newline="\n")
    before = sum(item["bytes"] for item in manifest.values())
    after = sum(item["variants"][-1]["bytes"] for item in manifest.values())
    print(f"{len(manifest)} originals backed up; full-size lossless: {before:,} -> {after:,} bytes")


if __name__ == "__main__":
    main()
