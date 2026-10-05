"""Offline storage tests; neither Azure nor a database is contacted."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

module_path = Path(__file__).resolve().parents[1] / 'endpoint_files' / 'azure_storage.py'
spec = importlib.util.spec_from_file_location('isolated_storage', module_path)
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class LocalStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.environment = patch.dict(os.environ, {'LOCAL_TEST_MODE': '1', 'AZURE_STORAGE_CONNECTION_STRING': ''})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.path_patch = patch.object(storage, 'LOCAL_STORAGE_ROOT', self.root, create=True)
        self.path_patch.start()
        self.addCleanup(self.path_patch.stop)

    def test_local_upload_and_delete_do_not_contact_azure(self):
        with patch.object(storage, '_container_client') as cloud:
            url = storage.upload_bytes('card_images/fixture.png', b'fixture', 'image/png')
            self.assertEqual(url, '/uploads/local_test/images/card_images/fixture.png')
            self.assertEqual((self.root / 'images/card_images/fixture.png').read_bytes(), b'fixture')
            storage.delete_from_url(url)
            self.assertFalse((self.root / 'images/card_images/fixture.png').exists())
            storage.delete_from_url(url)  # Idempotent cleanup.
            cloud.assert_not_called()

    def test_local_upload_supports_thumbnail_and_attachment_paths(self):
        for name in ('thumbnails/fixture.png', 'files/fixture.zip'):
            with self.subTest(name=name):
                url = storage.upload_bytes(name, b'fixture')
                self.assertTrue(url.startswith('/uploads/local_test/'))
                storage.delete_blob(name)
                self.assertFalse((self.root / 'images' / name).exists())

    def test_local_mode_does_not_delete_remote_azure_files(self):
        with patch.object(storage, '_container_client') as cloud:
            storage.delete_from_url('https://example.blob.core.windows.net/images/fixture.png')
            cloud.assert_not_called()

    def test_paths_cannot_escape_the_local_upload_directory(self):
        for name in ('../outside.png', '/outside.png', 'card_images/../../outside.png', 'card_images\\outside.png'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                storage.upload_bytes(name, b'fixture')
        with self.assertRaises(ValueError):
            storage.upload_bytes('fixture.png', b'fixture', container='../outside')

    def test_production_upload_still_uses_azure(self):
        cloud = MagicMock()
        with patch.dict(os.environ, {'LOCAL_TEST_MODE': '0'}), patch.object(storage, '_container_client', return_value=cloud):
            url = storage.upload_bytes('card_images/fixture.png', b'fixture', 'image/png')
        self.assertIn('.blob.core.windows.net/', url)
        cloud.upload_blob.assert_called_once()
        self.assertFalse((self.root / 'images/card_images/fixture.png').exists())


if __name__ == '__main__':
    unittest.main()
