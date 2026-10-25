"""Bounded, streaming display derivatives; original files stay intact."""
import os
import threading
import warnings
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
import io

# libvips decodes/resizes sequentially rather than making full-sized canvas/RGBA
# copies. Limit worker/cache memory on small backend instances.
os.environ.setdefault('VIPS_CONCURRENCY', '2')
import pyvips
pyvips.cache_set_max(0)
pyvips.cache_set_max_mem(32 * 1024 * 1024)
_processing_slot = threading.BoundedSemaphore(1)

MAX_IMAGE_BYTES = 50 * 1024 * 1024
MAX_IMAGE_PIXELS = 160_000_000
DISPLAY_EDGE = 4096
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
ALLOWED_FORMATS = {'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP'}


def prepare_image(file):
    file.file.seek(0)
    original = file.file.read(MAX_IMAGE_BYTES + 1)
    file.file.seek(0)
    if len(original) > MAX_IMAGE_BYTES:
        raise HTTPException(413, 'Image exceeds 50 MiB. Choose a smaller original file.')
    try:
        with _processing_slot, warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            # Pillow only reads the header: it never decodes the original here.
            with Image.open(io.BytesIO(original)) as header:
                if header.format not in ALLOWED_FORMATS:
                    raise HTTPException(415, 'Use a PNG, JPG, WebP, GIF or BMP image.')
                if header.width * header.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, 'Image exceeds 160 megapixels. Reduce its pixel dimensions and retry.')
                if header.format == 'BMP':
                    # The bundled vips build lacks a BMP loader. Ordinary BMPs
                    # are bounded by the byte limit; guard highly compressed RLE.
                    if header.width * header.height > 40_000_000:
                        raise HTTPException(413, 'Large compressed BMP images must be exported as PNG or JPG before uploading.')
                    header.thumbnail((DISPLAY_EDGE, DISPLAY_EDGE), Image.Resampling.LANCZOS, reducing_gap=3)
                    display = ImageOps.exif_transpose(header).convert('RGB')
                    output = io.BytesIO()
                    display.save(output, format='WEBP', quality=88)
                    return original, output.getvalue(), display.width, display.height
            display = pyvips.Image.thumbnail_buffer(original, DISPLAY_EDGE, height=DISPLAY_EDGE,
                                                     size='down', no_rotate=False, fail_on='error')
            data = display.webpsave_buffer(Q=88, strip=True)
            return original, data, display.width, display.height
    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(413, 'Image exceeds 160 megapixels. Reduce its pixel dimensions and retry.')
    except (UnidentifiedImageError, OSError, ValueError, pyvips.Error):
        raise HTTPException(422, 'This image could not be decoded. Export it as PNG, JPG or WebP and retry.')
    except MemoryError:
        raise HTTPException(413, 'This image needs too much memory to process. Reduce its pixel dimensions and retry.')
