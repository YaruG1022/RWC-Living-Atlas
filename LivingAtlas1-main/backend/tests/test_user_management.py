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
        self.db.get_request_connection.reset_mock()
        self.db.get_request_connection.return_value = self.connection
        self.admin = (1, 'admin@example.invalid', True)
        self.headers = {'Authorization': f"Bearer {'s' * 43}"}
        self.db.release_request_connection.reset_mock()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_list_has_a_stable_shape_and_timestamps(self):
        self.cursor.fetchone.return_value = self.admin
        self.cursor.fetchall.return_value = [('Member', 'member@example.invalid', False, None, None, 'unknown')]
        response = await self.client.post('/list_database', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['users'][0], dict(
            name='Member', email='member@example.invalid', is_admin=False,
            created_at=None, last_online_at=None, presence_status='unknown',
        ))
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_heartbeat_requires_a_valid_session(self):
        response = await self.client.post('/session/heartbeat')
        self.assertEqual(response.status_code, 401)
        self.db.get_request_connection.assert_not_called()

        self.cursor.fetchone.return_value = None
        response = await self.client.post('/session/heartbeat', headers=self.headers)
        self.assertEqual(response.status_code, 401)
        self.cursor.execute.assert_called_once()

    async def test_heartbeat_updates_presence_for_the_verified_regular_user(self):
        self.cursor.fetchone.side_effect = [(2, 'member@example.invalid', False), (2,)]
        response = await self.client.post('/session/heartbeat', headers=self.headers)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b'')
        _, user_update, token_update = self.cursor.execute.call_args_list
        self.assertIn('UPDATE Users SET PresenceObserved = TRUE', user_update.args[0])
        self.assertEqual(user_update.args[1], (2,))
        self.assertIn('SET LastSeenAt', token_update.args[0])
        self.assertIn("Purpose = 'session'", token_update.args[0])
        self.assertIn('ExpiresAt > statement_timestamp()', token_update.args[0])
        self.connection.__exit__.assert_called_once_with(None, None, None)

    async def test_heartbeat_rolls_back_if_session_is_revoked_during_update(self):
        self.cursor.fetchone.side_effect = [self.admin, None]
        response = await self.client.post('/session/heartbeat', headers=self.headers)
        self.assertEqual(response.status_code, 401)
        self.assertIsNotNone(self.connection.__exit__.call_args.args[0])
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_role_change_is_parameterized_and_commits(self):
        email = "o'connor@example.invalid"
        self.cursor.fetchone.side_effect = [self.admin, self.admin, (False,)]
        response = await self.client.post('/edit_user_role', headers=self.headers, json={'email': email, 'is_admin': True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(self.cursor.execute.call_args.args[1], (True, email))
        self.connection.__exit__.assert_called_once_with(None, None, None)
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_last_admin_cannot_be_demoted(self):
        self.cursor.fetchone.side_effect = [self.admin, self.admin, (True,), (1,)]
        response = await self.client.post('/edit_user_role', headers=self.headers, json={'email': 'admin@example.invalid', 'is_admin': False})
        self.assertEqual(response.status_code, 409)
        self.assertIn('last admin', response.json()['detail'])
        self.assertFalse(any('UPDATE' in call.args[0] for call in self.cursor.execute.call_args_list))
        self.assertIsNotNone(self.connection.__exit__.call_args.args[0])

    async def test_admin_can_be_demoted_when_another_remains(self):
        self.cursor.fetchone.side_effect = [self.admin, self.admin, (True,), (2,)]
        response = await self.client.post('/edit_user_role', headers=self.headers, json={'email': 'admin@example.invalid', 'is_admin': False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cursor.execute.call_args.args[1], (False, 'admin@example.invalid'))

    async def test_invalid_role_payloads_are_rejected(self):
        for payload in [{}, {'email': 'member@example.invalid'}, {'email': 'member@example.invalid', 'is_admin': 'false'}, {'email': 'member@example.invalid', 'is_admin': None}]:
            response = await self.client.post('/edit_user_role', headers=self.headers, json=payload)
            self.assertEqual(response.status_code, 422)
        self.cursor.execute.assert_not_called()

    async def test_missing_targets_return_404(self):
        for path, kwargs in [('/edit_user_role', {'json': {'email': 'missing@example.invalid', 'is_admin': True}}), ('/delete_user/missing@example.invalid', {})]:
            self.cursor.fetchone.side_effect = [self.admin, self.admin, None]
            response = await self.client.post(path, headers=self.headers, **kwargs)
            self.assertEqual(response.status_code, 404)

    async def test_admin_deletion_is_blocked(self):
        self.cursor.fetchone.side_effect = [self.admin, self.admin, (True,)]
        response = await self.client.post('/delete_user/admin@example.invalid', headers=self.headers)
        self.assertEqual(response.status_code, 409)
        self.assertFalse(any('DELETE' in call.args[0] for call in self.cursor.execute.call_args_list))

    async def test_regular_user_deletion_succeeds(self):
        self.cursor.fetchone.side_effect = [self.admin, self.admin, (False,)]
        response = await self.client.post('/delete_user/member%2Btest%231@example.invalid', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(self.cursor.execute.call_args.args[1], ('member+test#1@example.invalid',))

    async def test_linked_content_returns_conflict_without_leaking_sql(self):
        self.cursor.fetchone.side_effect = [self.admin, self.admin, (False,)]
        self.cursor.execute.side_effect = [None, None, None, None, psycopg2.errors.ForeignKeyViolation('private SQL details')]
        response = await self.client.post('/delete_user/member@example.invalid', headers=self.headers)
        self.assertEqual(response.status_code, 409)
        self.assertIn('linked content', response.json()['detail'])
        self.assertNotIn('private SQL', response.text)
        self.assertIsNotNone(self.connection.__exit__.call_args.args[0])
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_database_failure_is_not_a_success_response(self):
        self.cursor.execute.side_effect = RuntimeError('private SQL details')
        response = await self.client.post('/list_database', headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private SQL', response.text)
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_unavailable_database_returns_503(self):
        self.db.get_request_connection.return_value = None
        response = await self.client.post('/list_database', headers=self.headers)
        self.assertEqual(response.status_code, 503)

    async def test_management_requires_authentication_and_the_admin_role(self):
        routes = (
            ('/list_database', {}),
            ('/fetch_signup_requests', {}),
            ('/edit_user_role', {'json': {'email': 'member@example.invalid', 'is_admin': True}}),
            ('/delete_user/member@example.invalid', {}),
            ('/deny_request/member@example.invalid', {}),
        )
        for path, kwargs in routes:
            with self.subTest(path=path):
                self.cursor.reset_mock()
                self.db.get_request_connection.reset_mock()
                response = await self.client.post(path, **kwargs)
                self.assertEqual(response.status_code, 401)
                self.db.get_request_connection.assert_not_called()

                self.cursor.fetchone.return_value = (2, 'member@example.invalid', False)
                response = await self.client.post(path, headers=self.headers, **kwargs)
                self.assertEqual(response.status_code, 403)
                self.cursor.execute.assert_called_once()
                self.assertIn('FROM AccountTokens', self.cursor.execute.call_args.args[0])

    async def test_password_recovery_delivers_only_to_the_matching_account(self):
        email = 'member@example.invalid'
        self.cursor.fetchone.side_effect = [(2, email), None]
        with patch.object(self.routes, 'send_via_resend') as send:
            known = await self.client.post('/forgot-password', json={'email': email})
            unknown = await self.client.post('/forgot-password', json={'email': 'unknown@example.invalid'})
        self.assertEqual(known.status_code, 200)
        self.assertEqual(known.json(), unknown.json())
        send.assert_called_once()
        self.assertEqual(send.call_args.args[0], email)
        self.assertIn('https://rwc-living-atlas.netlify.app/reset-password#token=', send.call_args.args[2])
        self.assertNotIn(email, send.call_args.args[2])
        self.assertTrue(any(
            'INSERT INTO AccountTokens' in call.args[0] and call.args[1][2] == 'password_reset'
            for call in self.cursor.execute.call_args_list
        ))

    async def test_password_change_requires_a_verified_session_or_recovery_proof(self):
        response = await self.client.post('/reset-password', json={'new_password': 'test-password'})
        self.assertEqual(response.status_code, 401)
        response = await self.client.post('/reset-password', json={
            'email': 'member@example.invalid', 'new_password': 'test-password',
        })
        self.assertEqual(response.status_code, 422)
        self.db.get_request_connection.assert_not_called()

    async def test_invalid_recovery_proof_does_not_fall_back_to_session(self):
        self.cursor.fetchone.return_value = None
        response = await self.client.post('/reset-password', headers=self.headers, json={
            'new_password': 'test-password', 'reset_token': 'r' * 43,
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.cursor.execute.call_count, 2)
        self.assertIn("t.Purpose = 'password_reset'", self.cursor.execute.call_args.args[0])

    async def test_reset_uses_the_recovery_account_and_revokes_all_its_tokens(self):
        self.cursor.fetchone.side_effect = [(2,), (2,)]
        response = await self.client.post('/reset-password', json={
            'new_password': 'test-password', 'reset_token': 'r' * 43,
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        update, revoke = self.cursor.execute.call_args_list[-2:]
        self.assertIn('UPDATE Users', update.args[0])
        self.assertEqual(update.args[1][2], 2)
        self.assertEqual(update.args[1][0], self.routes.hash_password('test-password', update.args[1][1]))
        self.assertIn('DELETE FROM AccountTokens WHERE UserID', revoke.args[0])
        self.assertEqual(revoke.args[1], (2,))

    async def test_signed_in_password_change_revalidates_the_session_under_the_account_lock(self):
        account = (2, 'member@example.invalid', False)
        self.cursor.fetchone.side_effect = [account, (2,), None]
        response = await self.client.post('/reset-password', headers=self.headers, json={
            'new_password': 'test-password',
        })
        self.assertEqual(response.status_code, 401)
        self.assertFalse(any('UPDATE Users' in call.args[0] for call in self.cursor.execute.call_args_list))
