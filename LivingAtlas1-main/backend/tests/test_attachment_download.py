"""Offline attachment response tests: no database or Azure requests."""
import importlib
import asyncio
import httpx
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.parse import quote
from fastapi import FastAPI

# Load only the storage/response modules, bypassing endpoint_files' DB-owning init.
package = types.ModuleType('attachment_test_package')
package.__path__ = [str(Path(__file__).resolve().parents[1] / 'endpoint_files')]
sys.modules[package.__name__] = package
downloads = importlib.import_module('attachment_test_package.attachment_download')
storage = downloads.azure_storage


class LocalAppClient:
    def __init__(self, app):
        self.app = app

    def get(self, path):
        async def request():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://testserver') as client:
                return await client.get(path)
        return asyncio.run(request())


class AttachmentDownloadTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        for context in (patch.dict(os.environ, {'LOCAL_TEST_MODE': '1', 'AZURE_ACCOUNT': 'fixture', 'AZURE_STORAGE_CONNECTION_STRING': ''}), patch.object(storage, 'LOCAL_STORAGE_ROOT', self.root)):
            context.start()
            self.addCleanup(context.stop)
        self.filename = '重要话题'
        self.blob = 'files/fixture/重要话题.zip'
        self.local_url = storage.upload_bytes(self.blob, b'attachment-fixture')
        self.cloud_url = storage.build_url(self.blob)
        self.app = FastAPI()
        self.url = self.local_url
        @self.app.get('/download')
        def download():
            return downloads.attachment_response(self.filename, self.url, '.zip')
        self.client = LocalAppClient(self.app)

    def test_local_download_returns_bytes_and_unicode_attachment_header(self):
        response = self.client.get('/download')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'attachment-fixture')
        self.assertEqual(response.headers['content-type'], 'application/octet-stream')
        self.assertIn('attachment;', response.headers['content-disposition'])
        self.assertIn(quote(self.filename + '.zip'), response.headers['content-disposition'])
        self.assertNotIn('location', response.headers)

    def test_legacy_cloud_link_downloads_existing_local_file(self):
        self.url = self.cloud_url
        with patch.object(storage, '_container_client') as cloud:
            self.assertEqual(self.client.get('/download').content, b'attachment-fixture')
            cloud.assert_not_called()

    def test_missing_or_unowned_files_return_404_without_network_requests(self):
        for url in ('https://other.blob.core.windows.net/images/files/no.zip', '/uploads/local_test/images/../outside.zip', '/uploads/local_test/images/files/missing.zip'):
            self.url = url
            with self.subTest(url=url):
                self.assertEqual(self.client.get('/download').status_code, 404)

    def test_cloud_download_streams_bytes_instead_of_redirecting(self):
        self.url = self.cloud_url
        cloud = MagicMock()
        cloud.get_blob_client.return_value.download_blob.return_value.chunks.return_value = iter([b'first', b'second'])
        with patch.dict(os.environ, {'LOCAL_TEST_MODE': '0'}), patch.object(storage, '_container_client', return_value=cloud):
            response = self.client.get('/download')
        self.assertEqual(response.content, b'firstsecond')
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment;', response.headers['content-disposition'])
        cloud.get_blob_client.assert_called_once_with(self.blob)

    def test_cloud_storage_errors_return_clear_status(self):
        from azure.core.exceptions import ResourceNotFoundError
        self.url = self.cloud_url
        for error, status in ((ResourceNotFoundError(), 404), (RuntimeError('unavailable'), 502)):
            cloud = MagicMock()
            cloud.get_blob_client.return_value.download_blob.side_effect = error
            with patch.dict(os.environ, {'LOCAL_TEST_MODE': '0'}), patch.object(storage, '_container_client', return_value=cloud):
                self.assertEqual(self.client.get('/download').status_code, status)


if __name__ == '__main__':
    unittest.main()
