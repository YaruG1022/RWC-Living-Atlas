"""Management API regressions without a database or external services."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import psycopg2
from fastapi import FastAPI


class UserManagementTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = types.ModuleType('database')
        cls.db.conn = MagicMock()
        cls.db.cur = MagicMock()
        cls.db.get_request_connection = MagicMock()
        cls.db.release_request_connection = MagicMock()
        spec = importlib.util.spec_from_file_location('user_management_test_routes', Path(__file__).resolve().parents[1] / 'account.py')
        cls.routes = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'database': cls.db}):
            spec.loader.exec_module(cls.routes)
        cls.app = FastAPI()
        cls.app.include_router(cls.routes.account_router)

    async def asyncSetUp(self):
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value
        self.db.get_request_connection.return_value = self.connection
        self.db.release_request_connection.reset_mock()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_list_has_a_stable_shape_and_timestamps(self):
        self.cursor.fetchall.return_value = [('Member', 'member@example.invalid', False, None, None)]
        response = await self.client.post('/list_database')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['users'][0], dict(name='Member', email='member@example.invalid', is_admin=False, created_at=None, last_online_at=None))
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_role_change_is_parameterized_and_commits(self):
        email = "o'connor@example.invalid"
        self.cursor.fetchone.return_value = (False,)
        response = await self.client.post('/edit_user_role', json={'email': email, 'is_admin': True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(self.cursor.execute.call_args.args[1], (True, email))
        self.connection.__exit__.assert_called_once_with(None, None, None)
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_last_admin_cannot_be_demoted(self):
        self.cursor.fetchone.side_effect = [(True,), (1,)]
        response = await self.client.post('/edit_user_role', json={'email': 'admin@example.invalid', 'is_admin': False})
        self.assertEqual(response.status_code, 409)
        self.assertIn('last admin', response.json()['detail'])
        self.assertFalse(any('UPDATE' in call.args[0] for call in self.cursor.execute.call_args_list))
        self.assertIsNotNone(self.connection.__exit__.call_args.args[0])

    async def test_admin_can_be_demoted_when_another_remains(self):
        self.cursor.fetchone.side_effect = [(True,), (2,)]
        response = await self.client.post('/edit_user_role', json={'email': 'admin@example.invalid', 'is_admin': False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cursor.execute.call_args.args[1], (False, 'admin@example.invalid'))

    async def test_invalid_role_payloads_are_rejected(self):
        for payload in [{}, {'email': 'member@example.invalid'}, {'email': 'member@example.invalid', 'is_admin': 'false'}, {'email': 'member@example.invalid', 'is_admin': None}]:
            response = await self.client.post('/edit_user_role', json=payload)
            self.assertEqual(response.status_code, 422)
        self.cursor.execute.assert_not_called()

    async def test_missing_targets_return_404(self):
        self.cursor.fetchone.return_value = None
        for path, kwargs in [('/edit_user_role', {'json': {'email': 'missing@example.invalid', 'is_admin': True}}), ('/delete_user/missing@example.invalid', {})]:
            response = await self.client.post(path, **kwargs)
            self.assertEqual(response.status_code, 404)

    async def test_admin_deletion_is_blocked(self):
        self.cursor.fetchone.return_value = (True,)
        response = await self.client.post('/delete_user/admin@example.invalid')
        self.assertEqual(response.status_code, 409)
        self.assertFalse(any('DELETE' in call.args[0] for call in self.cursor.execute.call_args_list))

    async def test_regular_user_deletion_succeeds(self):
        self.cursor.fetchone.return_value = (False,)
        response = await self.client.post('/delete_user/member%2Btest%231@example.invalid')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(self.cursor.execute.call_args.args[1], ('member+test#1@example.invalid',))

    async def test_linked_content_returns_conflict_without_leaking_sql(self):
        self.cursor.fetchone.return_value = (False,)
        self.cursor.execute.side_effect = [None, None, psycopg2.errors.ForeignKeyViolation('private SQL details')]
        response = await self.client.post('/delete_user/member@example.invalid')
        self.assertEqual(response.status_code, 409)
        self.assertIn('linked content', response.json()['detail'])
        self.assertNotIn('private SQL', response.text)
        self.assertIsNotNone(self.connection.__exit__.call_args.args[0])
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_database_failure_is_not_a_success_response(self):
        self.cursor.execute.side_effect = RuntimeError('private SQL details')
        response = await self.client.post('/list_database')
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private SQL', response.text)
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_unavailable_database_returns_503(self):
        self.db.get_request_connection.return_value = None
        response = await self.client.post('/list_database')
        self.assertEqual(response.status_code, 503)
