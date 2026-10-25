"""Offline HTTP contracts for custom-library request isolation and recovery."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
import httpx


class CustomLayerTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        database = types.ModuleType('database')
        for name in ('conn', 'cur', 'get_request_connection', 'release_request_connection'):
            setattr(database, name, MagicMock())
        path = Path(__file__).resolve().parents[1] / 'endpoint_files' / 'arcgis.py'
        spec = importlib.util.spec_from_file_location('custom_layer_routes_test', path)
        cls.routes = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'database': database}):
            spec.loader.exec_module(cls.routes)
        cls.database = database
        app = FastAPI()
        app.include_router(cls.routes.arcgis_router)
        cls.app = app

    def setUp(self):
        self.database.cur.reset_mock()
        self.database.conn.reset_mock()
        self.database.get_request_connection.reset_mock()
        self.database.release_request_connection.reset_mock()
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value
        self.cursor.fetchone.return_value = (0,)
        self.cursor.fetchall.return_value = []
        self.cursor.rowcount = 1
        self.database.get_request_connection.side_effect = None
        self.database.get_request_connection.return_value = self.connection

    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    def tearDown(self):
        self.database.cur.execute.assert_not_called()
        self.database.conn.commit.assert_not_called()
        self.database.conn.rollback.assert_not_called()
        self.assertFalse(any('CREATE ' in c.args[0] or 'ALTER ' in c.args[0]
                             for c in self.cursor.execute.call_args_list))

    def payload(self, **extra):
        return dict(user_email='probe@example.invalid', service_key='probe',
                    label='Probe', url='https://example.invalid/MapServer', **extra)

    async def test_save_commits_and_releases_request_connection(self):
        response = await self.client.post('/arcgis/custom-layers/save', json=self.payload(folder='Water'))
        self.assertEqual(response.status_code, 200, response.text)
        self.connection.commit.assert_called_once()
        self.database.release_request_connection.assert_called_once_with(self.connection)
        statements = [c.args[0] for c in self.cursor.execute.call_args_list]
        self.assertTrue(any('INSERT INTO user_custom_folders' in sql for sql in statements))
        self.assertTrue(any('COALESCE(EXCLUDED.geojson' in sql for sql in statements))

    async def test_separate_requests_get_separate_result_sets(self):
        second = MagicMock()
        second.cursor.return_value.__enter__.return_value.fetchall.return_value = [('Water', 2)]
        self.database.get_request_connection.side_effect = [self.connection, second]
        response = await self.client.get('/arcgis/custom-layers', params={'user_email':'probe@example.invalid'})
        self.assertEqual(response.json(), [])
        response = await self.client.get('/arcgis/custom-folders', params={'user_email':'probe@example.invalid'})
        self.assertEqual(response.json(), [{'folder_name':'Water','sort_order':2}])
        self.assertEqual(self.database.release_request_connection.call_count, 2)

    async def test_failed_write_rolls_back_and_returns_actionable_message(self):
        self.cursor.execute.side_effect = RuntimeError('private database diagnostic')
        with self.assertLogs(self.routes.__name__, level='ERROR'):
            response = await self.client.post('/arcgis/custom-layers/save', json=self.payload())
        self.assertEqual(response.status_code, 500)
        self.assertIn('Please try again', response.json()['detail'])
        self.assertNotIn('private database', response.text)
        self.connection.rollback.assert_called_once()
        self.connection.commit.assert_not_called()
        self.database.release_request_connection.assert_called_once_with(self.connection)

    async def test_unavailable_pool_returns_retryable_error(self):
        self.database.get_request_connection.return_value = None
        response = await self.client.post('/arcgis/custom-layers/save', json=self.payload())
        self.assertEqual(response.status_code, 503)
        self.assertIn('try again', response.json()['detail'])
        self.database.release_request_connection.assert_not_called()

    async def test_not_found_still_releases_connection(self):
        self.cursor.fetchone.return_value = None
        response = await self.client.get('/arcgis/custom-layers/geojson', params={'user_email':'probe@example.invalid','service_key':'missing'})
        self.assertEqual(response.status_code, 404)
        self.database.release_request_connection.assert_called_once_with(self.connection)

    async def test_all_library_mutations_use_request_connection_without_ddl(self):
        for method, path, data in [
            ('DELETE','/custom-layers',{'service_key':'probe'}),
            ('PUT','/custom-layers/reorder',{'order':[{'service_key':'probe','sort_order':1}]}),
            ('PUT','/custom-layers/layer-order',{'service_key':'probe','layer_order':[2,1]}),
            ('POST','/custom-folders',{'folder_name':'Water'}),
            ('DELETE','/custom-folders',{'folder_name':'Water'}),
            ('PUT','/custom-folders/rename',{'old_name':'Water','new_name':'Rivers'}),
        ]:
            with self.subTest(path=path, method=method):
                response = await self.client.request(method, '/arcgis'+path, json={'user_email':'probe@example.invalid', **data})
                self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.database.release_request_connection.call_count, 6)


if __name__ == '__main__':
    unittest.main()
