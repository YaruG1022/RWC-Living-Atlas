"""Check email two-factor authentication against isolated PostgreSQL with fake delivery.

Run from backend: python -m scripts.check_email_two_factor
"""

import asyncio
import os
import re
from contextlib import closing
from secrets import token_bytes, token_hex
from unittest.mock import patch
from uuid import uuid4

import httpx

from load_tests.common import db_connect
from local_config import load_local_config
from scripts.check_account_recovery import authorization, expect_status, sign_in
from sessions import hash_password


async def check_two_factor(client, db, account_module, user_id, email, other_email, password):
    setting_url = '/account/two-factor'
    setting_verify_url = f'{setting_url}/verify'
    setting_resend_url = f'{setting_url}/resend'
    login_url = '/profileAccount'
    login_verify_url = f'{login_url}/verify'
    login_resend_url = f'{login_url}/resend'
    credentials = {'email': email, 'password': password}
    enable = {'enabled': True, 'password': password}
    disable = {'enabled': False, 'password': password}
    signed_in = authorization(await sign_in(client, email, password))
    other_signed_in = authorization(await sign_in(client, other_email, password))

    def advance_challenge_clock(purpose='login', expire=False, remaining_seconds=None):
        with db, db.cursor() as cursor:
            cursor.execute(
                """
                UPDATE EmailTwoFactorChallenges SET NextSendAt = statement_timestamp(),
                    ExpiresAt = COALESCE(statement_timestamp() + %s::INT * interval '1 second', ExpiresAt),
                    AttemptWindowEndsAt = CASE WHEN %s THEN statement_timestamp() ELSE AttemptWindowEndsAt END
                WHERE UserID = %s AND Purpose = %s
                """,
                (0 if expire else remaining_seconds, expire, user_id, purpose),
            )
            assert cursor.rowcount == 1, 'Expected one synthetic challenge'

    def login_state():
        with db, db.cursor() as cursor:
            cursor.execute(
                """
                SELECT Last_Online_At, (SELECT COUNT(*) FROM AccountTokens t
                    WHERE t.UserID = u.UserID AND t.Purpose = 'session')
                FROM Users u WHERE u.UserID = %s
                """,
                (user_id,),
            )
            return cursor.fetchone()

    def mailed_code(response, sender, max_expiry=600):
        expect_status(response, 202)
        challenge = response.json()
        recipient, _, body = sender.call_args.args
        code = re.search(r'<strong>([0-9]{6})</strong>', body).group(1)
        assert recipient == email
        assert 'session_token' not in challenge and 'Account Information' not in challenge
        assert code not in response.text and 0 < challenge['expires_in'] <= max_expiry
        assert challenge['resend_after'] == 60
        assert response.headers['cache-control'] == 'no-store'
        return {'challenge_id': challenge['challenge_id'], 'code': code}

    with patch.object(account_module, 'send_via_resend') as sender:
        expect_status(await client.get(setting_url), 401)
        current = await client.get(setting_url, headers=signed_in)
        expect_status(current, 200)
        assert current.json() == {'enabled': False}
        expect_status(await client.put(setting_url, headers=signed_in, json={**enable, 'password': 'wrong'}), 401)
        sender.assert_not_called()

        sender.side_effect = RuntimeError('provider details should not be returned')
        failed = await client.put(setting_url, headers=signed_in, json=enable)
        expect_status(failed, 503)
        assert 'provider details' not in failed.text and 'challenge_id' not in failed.json()
        assert (await client.get(setting_url, headers=signed_in)).json() == {'enabled': False}
        advance_challenge_clock('enrollment')
        sender.side_effect = None

        challenge = mailed_code(await client.put(setting_url, headers=signed_in, json=enable), sender)
        expect_status(await client.post(setting_verify_url, headers=other_signed_in, json=challenge), 410)
        expect_status(await client.post(login_verify_url, json=challenge), 410)
        resend_request = {'challenge_id': challenge['challenge_id']}
        mail_count = sender.call_count
        expect_status(await client.post(setting_resend_url, json=resend_request), 401)
        expect_status(await client.post(setting_resend_url, headers=other_signed_in, json=resend_request), 410)
        expect_status(await client.post(login_resend_url, json=resend_request), 410)
        cooldown = await client.post(setting_resend_url, headers=signed_in, json=resend_request)
        expect_status(cooldown, 429)
        assert int(cooldown.headers['retry-after']) > 0 and sender.call_count == mail_count
        advance_challenge_clock('enrollment', remaining_seconds=300)
        new_code = f"{(int(challenge['code']) + 1) % 1_000_000:06d}"
        # A randomly generated replacement must be redrawn if it matches the previous code.
        with patch('email_two_factor._generate_code', side_effect=[challenge['code'], new_code]):
            response = await client.post(setting_resend_url, headers=signed_in, json=resend_request)
        replacement = mailed_code(response, sender, max_expiry=300)
        assert replacement == {**resend_request, 'code': new_code}
        expect_status(await client.post(setting_verify_url, headers=signed_in, json=challenge), 401)
        assert (await client.get(setting_url, headers=signed_in)).json() == {'enabled': False}
        enrolled = await client.post(setting_verify_url, headers=signed_in, json=replacement)
        expect_status(enrolled, 200)
        assert enrolled.json() == {'enabled': True}
        expect_status(await client.post(setting_verify_url, headers=signed_in, json=replacement), 410)

        before = login_state()
        mail_count = sender.call_count
        legacy = await client.get(login_url, params=credentials)
        expect_status(legacy, 200)
        assert legacy.json() == {'Account Information': []}
        expect_status(await client.post(login_url, json={**credentials, 'password': 'wrong'}), 401)
        assert sender.call_count == mail_count and login_state() == before

        first_step = await client.post(login_url, headers=other_signed_in, json=credentials)
        challenge = mailed_code(first_step, sender)
        assert first_step.json()['two_factor_required'] is True
        assert login_state() == before
        assert (await client.get(setting_url, headers=other_signed_in)).json() == {'enabled': False}
        with db, db.cursor() as cursor:
            cursor.execute('SELECT ChallengeHash, CodeDigest FROM EmailTwoFactorChallenges WHERE UserID = %s AND Purpose = %s', (user_id, 'login'))
            challenge_hash, digest = cursor.fetchone()
            assert challenge_hash != challenge['challenge_id'] and digest != challenge['code']

        cooldown = await client.post(login_url, json=credentials)
        expect_status(cooldown, 429)
        assert int(cooldown.headers['retry-after']) > 0
        resend_request = {'challenge_id': challenge['challenge_id']}
        cooldown = await client.post(login_resend_url, json=resend_request)
        expect_status(cooldown, 429)
        assert int(cooldown.headers['retry-after']) > 0
        wrong_code = '111111' if challenge['code'] != '111111' else '222222'
        for _ in range(4):
            expect_status(await client.post(login_verify_url, json={**challenge, 'code': wrong_code}), 401)

        advance_challenge_clock()
        replacement = mailed_code(await client.post(login_resend_url, json=resend_request), sender)
        assert replacement['challenge_id'] == challenge['challenge_id'] and replacement['code'] != challenge['code']
        exhausted = await client.post(login_verify_url, json=challenge)
        expect_status(exhausted, 429)
        assert int(exhausted.headers['retry-after']) > 0
        expect_status(await client.post(login_verify_url, json=replacement), 429)
        expect_status(await client.post(login_resend_url, json=resend_request), 429)
        assert login_state() == before

        advance_challenge_clock(expire=True)
        expect_status(await client.post(login_verify_url, json=replacement), 410)
        expect_status(await client.post(login_resend_url, json=resend_request), 410)

        challenge = mailed_code(await client.post(login_url, headers=other_signed_in, json=credentials), sender)
        resend_request = {'challenge_id': challenge['challenge_id']}
        advance_challenge_clock()
        sender.side_effect = RuntimeError('provider details should not be returned')
        failed = await client.post(login_resend_url, json=resend_request)
        expect_status(failed, 503)
        assert int(failed.headers['retry-after']) > 0 and 'provider details' not in failed.text
        sender.side_effect = None
        expect_status(await client.post(login_resend_url, json=resend_request), 429)
        advance_challenge_clock()
        challenge = mailed_code(await client.post(login_resend_url, json=resend_request), sender)
        assert challenge['challenge_id'] == resend_request['challenge_id'] and login_state() == before
        assert (await client.get(setting_url, headers=other_signed_in)).json() == {'enabled': False}
        results = await asyncio.gather(*(
            client.post(login_verify_url, headers=other_signed_in, json=challenge) for _ in range(2)
        ))
        assert sorted(result.status_code for result in results) == [200, 410], 'A concurrent replay must fail'
        success = next(result.json() for result in results if result.status_code == 200)
        assert success['Account Information'][0][1] == email
        verified = authorization(success['session_token'])
        now_online, sessions = login_state()
        assert now_online > before[0] and sessions == before[1] + 1
        expect_status(await client.get(setting_url, headers=other_signed_in), 401)

        pending = mailed_code(await client.post(login_url, json=credentials), sender)
        new_password = token_hex(16)
        reset = await client.post('/reset-password', headers=verified, json={'new_password': new_password})
        expect_status(reset, 200)
        expect_status(await client.post(login_verify_url, json=pending), 410)
        expect_status(await client.post(login_resend_url, json={'challenge_id': pending['challenge_id']}), 410)
        expect_status(await client.get(setting_url, headers=verified), 401)
        expect_status(await client.post(login_url, json=credentials), 401)

        credentials['password'] = new_password
        advance_challenge_clock()
        challenge = mailed_code(await client.post(login_url, json=credentials), sender)
        login = await client.post(login_verify_url, json=challenge)
        expect_status(login, 200)
        verified = authorization(login.json()['session_token'])
        assert (await client.get(setting_url, headers=verified)).json() == {'enabled': True}
        expect_status(await client.put(setting_url, headers=verified, json=disable), 401)
        pending = mailed_code(await client.post(login_url, json=credentials), sender)
        disabled = await client.put(setting_url, headers=verified, json={**disable, 'password': new_password})
        expect_status(disabled, 200)
        assert disabled.json() == {'enabled': False}
        expect_status(await client.post(login_verify_url, json=pending), 410)
        await sign_in(client, email, new_password)


async def main():
    load_local_config()
    port = '5432' if os.getenv('CI_POSTGRES_TEST') == '1' else '5433'
    target = tuple(os.getenv(key) for key in ('LOCAL_TEST_MODE', 'DB_HOST', 'DB_PORT', 'DB_NAME'))
    if target != ('1', '127.0.0.1', port, 'livingatlas_test') or os.getenv('DATABASE_URL'):
        raise RuntimeError(f'This check requires LOCAL_TEST_MODE=1 and 127.0.0.1:{port}/livingatlas_test.')

    with closing(db_connect()) as db:
        with db, db.cursor() as cursor:
            cursor.execute('SELECT current_database(), inet_server_port()')
            assert cursor.fetchone() == ('livingatlas_test', int(port)), 'Unexpected database or port'

        os.environ['DB_REQUEST_POOL_SIZE'] = '4'
        import account
        from main import app

        prefix = 'two_factor_check_' + uuid4().hex
        names = [prefix, f'{prefix}_other']
        emails = [f'{name}@example.invalid' for name in names]
        password = token_hex(16)
        with db, db.cursor() as cursor:
            cursor.execute('LOCK TABLE Users IN SHARE ROW EXCLUSIVE MODE')
            cursor.execute('SELECT COALESCE(MAX(UserID), 0) + 1 FROM Users')
            user_id = cursor.fetchone()[0]
            user_ids = [user_id, user_id + 1]
            for uid, name, email in zip(user_ids, names, emails):
                salt = token_bytes(32)
                cursor.execute(
                    'INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt) VALUES (%s, %s, %s, %s, %s)',
                    (uid, name, email, hash_password(password, salt), salt),
                )

        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url='http://two-factor-check') as client:
                await check_two_factor(client, db, account, user_id, *emails, password)
            print('PASS: opt-in, code resend, delivery failure, account binding, expiry, throttling, concurrent replay, reset and opt-out')
        finally:
            with db, db.cursor() as cursor:
                cursor.execute('DELETE FROM Users WHERE Email = ANY(%s)', (emails,))
                cursor.execute('SELECT COUNT(*) FROM Users WHERE Email = ANY(%s)', (emails,))
                assert cursor.fetchone()[0] == 0
                cursor.execute('SELECT COUNT(*) FROM AccountTokens WHERE UserID = ANY(%s)', (user_ids,))
                assert cursor.fetchone()[0] == 0
                cursor.execute('SELECT COUNT(*) FROM EmailTwoFactorChallenges WHERE UserID = ANY(%s)', (user_ids,))
                assert cursor.fetchone()[0] == 0
            print('PASS: removed synthetic accounts, sessions and challenges')


if __name__ == '__main__':
    asyncio.run(main())
