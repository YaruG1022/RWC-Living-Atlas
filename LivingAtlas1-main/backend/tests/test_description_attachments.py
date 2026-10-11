import importlib.util
from pathlib import Path
import unittest
import json

spec = importlib.util.spec_from_file_location('description_attachments', Path(__file__).resolve().parents[1] / 'endpoint_files' / 'description_attachments.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
TOKEN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'


class DescriptionAttachmentTests(unittest.TestCase):
    def test_resolves_uploaded_file_and_keeps_unrelated_links(self):
        html = f'<p><a href="#pending-file-{TOKEN}">报告</a><a href="https://example.com">Link</a></p>'
        self.assertEqual(module.parse_attachment_tokens(json.dumps([TOKEN, None]), 2, html), [TOKEN, None])
        resolved = module.resolve_attachment_token(html, TOKEN, 42)
        self.assertIn('/downloadFile?fileID=42', resolved)
        self.assertIn('https://example.com', resolved)
        self.assertNotIn('#pending-file-', resolved)

    def test_rejects_missing_and_duplicate_file_tokens(self):
        with self.assertRaises(ValueError):
            module.parse_attachment_tokens(None, 0, f'<a href="#pending-file-{TOKEN}">removed</a>')
        with self.assertRaises(ValueError):
            module.parse_attachment_tokens(json.dumps([TOKEN, TOKEN]), 2, '')

    def test_rejects_malformed_manifest(self):
        for raw in ['{}', '["invalid"]', 'not json', '[null, null]']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                module.parse_attachment_tokens(raw, 1, '')

    def test_old_clients_and_files_without_description_links(self):
        self.assertEqual(module.parse_attachment_tokens(None, 2, 'Legacy'), [None, None])
        self.assertEqual(module.resolve_attachment_token('Legacy', None, 42), 'Legacy')
