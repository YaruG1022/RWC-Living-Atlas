"""Offline gallery contract tests. No database or cloud storage is contacted."""
import asyncio
import contextlib
import importlib
import inspect
import io
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class GalleryContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database = types.ModuleType('database')
        database.conn = MagicMock()
        database.cur = MagicMock()
        for name in ('get_connection', 'get_request_connection', 'release_request_connection'):
            setattr(database, name, MagicMock())
        azure = types.ModuleType('endpoint_files.azure_storage')
        azure.build_url = lambda name: 'https://example.invalid/' + name
        file_utils = types.ModuleType('endpoint_files.file_utils')
        file_utils.compress_file = MagicMock()
        cls.modules = patch.dict(sys.modules, {
            'database': database,
            'endpoint_files.azure_storage': azure,
            'endpoint_files.file_utils': file_utils,
        })
        cls.modules.start()
        cls.images = importlib.import_module('endpoint_files.images')
        cls.cards = importlib.import_module('endpoint_files.card')
        cls.cur = database.cur
        cls.conn = database.conn

    @classmethod
    def tearDownClass(cls):
        cls.modules.stop()
        sys.modules.pop('endpoint_files.images', None)
        sys.modules.pop('endpoint_files.card', None)

    def setUp(self):
        self.cur.reset_mock()
        self.conn.reset_mock()
        self.cur.fetchone.side_effect = None
        self.cur.fetchall.side_effect = None

    def form(self, **overrides):
        values = {name: parameter.default.default for name, parameter in inspect.signature(self.cards.upload_form).parameters.items()}
        values.update(title='Gallery contract', username='fixture', email='fixture@example.invalid', name='Fixture', latitude='46', longitude='-117')
        values.update(overrides)
        with contextlib.redirect_stdout(io.StringIO()):
            return asyncio.run(self.cards.upload_form(**values))

    def test_create_and_update_all_layouts(self):
        layouts = ['multi', 'featured', 'slideshow'] + [f'grid-{i}' for i in range(1, 9)]
        for update in (False, True):
            for layout in layouts:
                with self.subTest(update=update, layout=layout):
                    self.cur.reset_mock()
                    self.cur.fetchone.side_effect = [(100,), (1,), (101,)] if update else [(100,), (1,)]
                    self.form(update=update, gallery_layout=layout)
                    statements = [call.args for call in self.cur.execute.call_args_list
                                  if ('UPDATE Cards' in call.args[0] or 'INSERT INTO Cards' in call.args[0])]
                    sql, params = statements[0]
                    self.assertIn('GalleryLayout', sql)
                    self.assertEqual(sql.count('%s'), len(params))
                    self.assertEqual(params[-2] if update else params[-1], layout)

    def test_legacy_update_preserves_layout(self):
        self.cur.fetchone.side_effect = [(100,), (1,), (101,)]
        self.form(update=True)
        sql, params = next(call.args for call in self.cur.execute.call_args_list if 'UPDATE Cards' in call.args[0])
        self.assertIn('GalleryLayout=COALESCE(%s, GalleryLayout)', sql)
        self.assertIsNone(params[-2])
        self.assertIsNone(params[10])  # Preserve an intentionally empty thumbnail.

    def test_new_cards_include_a_deletable_default_cover(self):
        self.cur.fetchone.side_effect = [(100,), (1,)]
        self.form()
        inserts = [call.args for call in self.cur.execute.call_args_list if 'INSERT INTO CardImages' in call.args[0]]
        self.assertEqual(len(inserts), 1)
        self.assertEqual(inserts[0][1], (101, self.cards.DEFAULT_THUMBNAIL_URL))

    def test_gallery_selection_validates_and_persists_without_deleting_images(self):
        for selection in ('[1, 3]', '[]'):
            with self.subTest(selection=selection):
                self.cur.reset_mock()
                self.cur.fetchone.side_effect = [(100,), (1,), (101,), ('point',)]
                self.cur.fetchall.return_value = [(1,), (2,), (3,)]
                self.form(update=True, gallery_image_ids=selection)
                sql, params = next(call.args for call in self.cur.execute.call_args_list if 'SET GalleryImageIDs' in call.args[0])
                self.assertEqual(params, (selection, 101))
                self.assertFalse(any('DELETE FROM CardImages' in call.args[0] for call in self.cur.execute.call_args_list))

    def test_invalid_selection_is_rejected_before_database_access(self):
        for selection in ('not-json', '{}', '[1,2,3,4,5,6,7]', '[1,1]', '[true]', '[0]', '["1"]'):
            with self.subTest(selection=selection):
                self.cur.reset_mock()
                with self.assertRaises(self.cards.HTTPException) as error:
                    self.form(update=True, gallery_image_ids=selection)
                self.assertEqual(error.exception.status_code, 422)
                self.cur.execute.assert_not_called()

    def test_other_cards_images_cannot_be_selected(self):
        self.cur.fetchone.side_effect = [(100,), (1,), (101,)]
        self.cur.fetchall.return_value = [(1,)]
        with self.assertRaises(self.cards.HTTPException) as error:
            self.form(update=True, gallery_image_ids='[999]')
        self.assertEqual(error.exception.status_code, 422)
        self.conn.rollback.assert_called()

    def test_deleting_a_shared_default_cover_does_not_delete_its_asset(self):
        for url in ('/CEREO-logo.png', self.cards.DEFAULT_THUMBNAIL_URL):
            with self.subTest(url=url):
                self.cur.fetchone.side_effect = [(url, 101), ('point',)]
                self.cur.fetchall.return_value = []
                with patch.object(self.images.azure_storage, 'delete_from_url', create=True) as delete:
                    result = asyncio.run(self.images.delete_card_image(61))
                    self.assertTrue(result['success'])
                    delete.assert_not_called()

    def test_invalid_layout_and_thirty_one_images_fail_before_database_access(self):
        for values in ({'gallery_layout': 'grid-9'}, {'images': [object()] * 31}):
            with self.subTest(values=list(values)):
                with self.assertRaises(self.cards.HTTPException) as error:
                    self.form(**values)
                self.assertEqual(error.exception.status_code, 422)
                self.cur.execute.assert_not_called()

    def test_thirtieth_image_allowed_and_thirty_first_rejected_under_card_lock(self):
        for existing, incoming in ((8, 1), (29, 1), (8, 22)):
            self.cur.fetchone.side_effect = [(101,), (existing,)]
            self.images.reserve_image_slots(101, incoming)
            self.assertIn('FOR UPDATE', self.cur.execute.call_args_list[-2].args[0])
        self.cur.fetchone.side_effect = [(101,), (30,)]
        with self.assertRaises(self.images.HTTPException) as error:
            self.images.reserve_image_slots(101, 1)
        self.assertEqual(error.exception.status_code, 422)

    def test_single_and_batch_upload_reject_overflow_before_storage_and_release_lock(self):
        for batch in (False, True):
            self.conn.reset_mock()
            self.cur.fetchone.side_effect = [(101,), (30,)]
            with patch.object(self.images, 'save_uploaded_file') as upload:
                with self.assertRaises(self.images.HTTPException) as error:
                    asyncio.run(self.images.upload_card_images(cardID=101, images=[object()], altTexts=None) if batch
                                else self.images.upload_card_image(cardID=101, image=object(), altText=''))
                self.assertEqual(error.exception.status_code, 422)
                upload.assert_not_called()
                self.conn.rollback.assert_called_once()

    def test_gallery_response_includes_saved_layout_and_missing_card_is_404(self):
        self.cur.fetchone.return_value = ('grid-8', [1])
        self.cur.fetchall.return_value = [(1, '/fixture.jpg', 0, 'Fixture', None)]
        result = asyncio.run(self.images.get_card_images(101))
        self.assertEqual(result['galleryLayout'], 'grid-8')
        self.assertEqual(result['galleryImageIDs'], [1])
        self.assertEqual(result['images'][0]['imageID'], 1)
        self.cur.fetchone.return_value = None
        with self.assertRaises(self.images.HTTPException) as error:
            asyncio.run(self.images.get_card_images(999))
        self.assertEqual(error.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
