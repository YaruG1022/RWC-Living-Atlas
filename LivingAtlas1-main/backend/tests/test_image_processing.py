"""Real high-resolution decoding, without database or cloud storage."""
import importlib.util
import io
import struct
import unittest
import zlib
from pathlib import Path
from types import SimpleNamespace
from PIL import Image
from fastapi import HTTPException

spec = importlib.util.spec_from_file_location('image_processor_tests', Path(__file__).resolve().parents[1] / 'endpoint_files/image_processing.py')
processor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


def png(width, height):
    encoder = zlib.compressobj()
    row = b'\0' * (width * 3 + 1)
    data = b''.join(encoder.compress(row) for _ in range(height)) + encoder.flush()
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', data) + chunk(b'IEND', b'')


def prepare(data):
    return processor.prepare_image(SimpleNamespace(file=io.BytesIO(data)))


class ImageProcessingTests(unittest.TestCase):
    def test_very_wide_and_144_megapixel_images_generate_bounded_display_without_cropping(self):
        for size in ((50000, 100), (12000, 12000)):
            with self.subTest(size=size):
                data = png(*size)
                original, display, width, height = prepare(data)
                self.assertEqual(original, data)
                self.assertLessEqual(max(width, height), 4096)
                self.assertLess(abs(width / height - size[0] / size[1]) / (size[0] / size[1]), .05)
                self.assertEqual(Image.open(io.BytesIO(display)).size, (width, height))

    def test_file_over_the_old_ten_mib_limit_is_supported(self):
        data = png(64, 64)
        data = data[:-12] + chunk(b'tEXt', b'note\0' + b'A' * (11 * 1024 * 1024)) + data[-12:]
        original, display, width, height = prepare(data)
        self.assertEqual(original, data)
        self.assertEqual((width, height), (64, 64))
        self.assertLess(len(display), 10000)

    def test_all_advertised_formats_have_decodable_display_images(self):
        for format in ('JPEG', 'PNG', 'GIF', 'WEBP', 'BMP'):
            with self.subTest(format=format):
                data = io.BytesIO()
                Image.new('RGB', (100, 50), 'blue').save(data, format=format)
                self.assertEqual(prepare(data.getvalue())[2:], (100, 50))

    def test_exif_rotation_and_transparency_survive_normalization(self):
        data = io.BytesIO()
        image = Image.new('RGB', (120, 80), 'green')
        exif = Image.Exif(); exif[274] = 6
        image.save(data, format='JPEG', exif=exif)
        self.assertEqual(prepare(data.getvalue())[2:], (80, 120))
        data = io.BytesIO()
        Image.new('RGBA', (20, 20), (0, 255, 0, 0)).save(data, format='PNG')
        display = Image.open(io.BytesIO(prepare(data.getvalue())[1]))
        self.assertEqual(display.getpixel((0, 0))[3], 0)

    def test_huge_dimensions_corrupt_images_and_file_limit_produce_actionable_errors(self):
        for data, status, message in [
            (b'corrupt image', 422, 'decoded'),
            (b'x' * (processor.MAX_IMAGE_BYTES + 1), 413, '50 MiB'),
            (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 20000, 20000, 8, 2, 0, 0, 0)) + chunk(b'IDAT', b''), 413, 'megapixels'),
        ]:
            with self.subTest(status=status, message=message), self.assertRaises(HTTPException) as error:
                prepare(data)
            self.assertEqual(error.exception.status_code, status)
            self.assertIn(message, error.exception.detail)


if __name__ == '__main__':
    unittest.main()
