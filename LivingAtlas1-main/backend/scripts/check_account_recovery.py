"""Check account recovery with isolated PostgreSQL and a fake mail sender.

Run from backend: python -m scripts.check_account_recovery
"""
import asyncio
import os
from contextlib import closing
from secrets import token_hex, token_bytes
from unittest.mock import patch
from uuid import uuid4

import httpx

from load_tests.common import db_connect
from local_config import load_local_config
from sessions import hash_password


def expect_status(response, status):
    assert response.status_code == status, f'{response.request.method} {response.request.url.path}: expected {status}, got {response.status_code}'


def authorization(token):
    return {'Authorization': f'Bearer {token}'}


async def sign_in(client, email, password):
    response = await client.post('/profileAccount', json={'email': email, 'password': password})
    expect_status(response, 200)
    assert response.headers.get('cache-control') == 'no-store'
    token = response.json().get('session_token')
    assert isinstance(token, str) and token, 'Successful sign-in must issue a session.'
    return token


async def main():
    load_local_config()
    target = tuple(os.getenv(key) for key in ('LOCAL_TEST_MODE', 'DB_HOST', 'DB_PORT', 'DB_NAME'))
    if target != ('1', '127.0.0.1', '5433', 'livingatlas_test') or os.getenv('DATABASE_URL'):
        raise RuntimeError('This check requires LOCAL_TEST_MODE=1 and 127.0.0.1:5433/livingatlas_test.')

    with closing(db_connect()) as db:
        with db, db.cursor() as cursor:
            cursor.execute('SELECT current_database(), inet_server_port()')
            assert cursor.fetchone() == ('livingatlas_test', 5433), 'Unexpected database or port'

        import account
        from main import app

        prefix = 'recovery_check_' + uuid4().hex
        username, other_username = (prefix + suffix for suffix in ('_primary', '_control'))
        email, other_email = (f'{name}@example.invalid' for name in (username, other_username))
        old_password, new_password, other_password = (token_hex(16) for _ in range(3))
        user_ids = []

        try:
            with db, db.cursor() as cursor:
                cursor.execute('LOCK TABLE Users IN SHARE ROW EXCLUSIVE MODE')
                cursor.execute('SELECT COALESCE(MAX(UserID), 0) + 1 FROM Users')
                user_id = cursor.fetchone()[0]
                user_ids = [user_id, user_id + 1]
                for uid, name, address, password in (
                    (user_id, username, email, old_password),
                    (user_id + 1, other_username, other_email, other_password),
                ):
                    salt = token_bytes(32)
                    cursor.execute(
                        'INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt) VALUES (%s, %s, %s, %s, %s)',
                        (uid, name, address, hash_password(password, salt), salt),
                    )

            transport = httpx.ASGITransport(app=app)
            with patch.object(account, 'send_recovery_email') as send_mail:
                async with httpx.AsyncClient(transport=transport, base_url='http://recovery-check') as client:
                    first_session = await sign_in(client, email, old_password)
                    second_session = await sign_in(client, email, old_password)
                    other_session = await sign_in(client, other_email, other_password)

                    recovery = await client.post('/forgot-password', json={'email': email})
                    unknown = await client.post('/forgot-password', json={'email': f'{prefix}_missing@example.invalid'})
                    expect_status(recovery, 200)
                    expect_status(unknown, 200)
                    assert recovery.json() == unknown.json(), 'Recovery responses should match for existing and missing accounts.'
                    assert send_mail.call_count == 1, 'Only the existing account should get a recovery email.'
                    recipient, recovery_token = send_mail.call_args.args
                    assert recipient == email and recovery_token and recovery_token not in recovery.text

                    response = await client.post('/reset-password', headers=authorization(recovery_token),
                                                 json={'new_password': new_password})
                    expect_status(response, 401)

                    # A browser can open a recovery link while signed in to another account.
                    reset_data = {'new_password': new_password, 'reset_token': recovery_token}
                    response = await client.post('/reset-password', headers=authorization(other_session), json=reset_data)
                    expect_status(response, 200)
                    assert response.json().get('success') is True
                    expect_status(await client.post('/reset-password', json=reset_data), 401)

                    for session in (first_session, second_session):
                        response = await client.post('/reset-password', headers=authorization(session),
                                                     json={'new_password': old_password})
                        expect_status(response, 401)
                    response = await client.post('/profileAccount', json={'email': email, 'password': old_password})
                    expect_status(response, 401)
                    await sign_in(client, email, new_password)
                    await sign_in(client, other_email, other_password)

                    response = await client.post('/forgot-password', json={'email': email})
                    expect_status(response, 200)
                    assert send_mail.call_count == 2
                    _, expired_token = send_mail.call_args.args
                    with db, db.cursor() as cursor:
                        cursor.execute(
                            "UPDATE AccountTokens SET ExpiresAt = statement_timestamp() - interval '1 minute' "
                            "WHERE UserID = %s AND Purpose = 'password_reset'",
                            (user_id,),
                        )
                        assert cursor.rowcount == 1
                    response = await client.post('/reset-password',
                                                 json={'new_password': old_password, 'reset_token': expired_token})
                    expect_status(response, 401)
                    await sign_in(client, email, new_password)

            print('PASS: generic recovery response, account-bound reset, token purpose, replay, expiry and revocation')
        finally:
            if user_ids:
                with db, db.cursor() as cursor:
                    cursor.execute('DELETE FROM Users WHERE Email = ANY(%s)', ([email, other_email],))
                    cursor.execute('SELECT COUNT(*) FROM Users WHERE Email = ANY(%s)', ([email, other_email],))
                    assert cursor.fetchone()[0] == 0
                    cursor.execute('SELECT COUNT(*) FROM AccountTokens WHERE UserID = ANY(%s)', (user_ids,))
                    assert cursor.fetchone()[0] == 0
                print('PASS: removed synthetic accounts and credentials')


if __name__ == '__main__':
    asyncio.run(main())
