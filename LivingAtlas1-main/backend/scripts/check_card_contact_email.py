"""Verify contact persistence and ownership using only the isolated local DB.

Run from backend: python -m scripts.check_card_contact_email
Uses the real ASGI routes and PostgreSQL, and removes its own fixtures.
"""
import asyncio
import os
import uuid

import httpx
import psycopg2

from local_config import load_local_config
from sessions import hash_password


async def main():
    load_local_config()
    assert os.getenv('LOCAL_TEST_MODE') == '1' and not os.getenv('DATABASE_URL')
    assert (os.getenv('DB_HOST'), os.getenv('DB_PORT'), os.getenv('DB_NAME')) == (
        '127.0.0.1', '5433', 'livingatlas_test')
    from main import app

    connection = psycopg2.connect(
        dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'], host=os.environ['DB_HOST'],
        port=os.environ['DB_PORT'], sslmode='disable', connect_timeout=5,
    )
    prefix = 'contact_check_' + uuid.uuid4().hex
    owner, colleague, admin = (f'{prefix}_{role}' for role in ('owner', 'colleague', 'admin'))
    owner_email, colleague_email = prefix + '_login@example.invalid', colleague + '@example.invalid'
    admin_email = admin + '@example.invalid'
    names = [owner, colleague, admin]
    password = uuid.uuid4().hex
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute('SELECT current_database()')
            assert cursor.fetchone()[0] == 'livingatlas_test'
            cursor.execute('LOCK TABLE Users IN SHARE ROW EXCLUSIVE MODE')
            cursor.execute('SELECT COALESCE(MAX(UserID), 0) + 1 FROM Users')
            user_id = cursor.fetchone()[0]
            accounts = []
            for i, (name, email, is_admin) in enumerate(
                ((owner, owner_email, False), (colleague, colleague_email, False), (admin, admin_email, True))
            ):
                salt = os.urandom(32)
                accounts.append((user_id + i, name, email, hash_password(password, salt), salt, is_admin))
            cursor.executemany(
                'INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt, Is_Admin) VALUES (%s,%s,%s,%s,%s,%s)',
                accounts,
            )

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://local-test') as client:
            fields = dict(username=owner, email=owner_email, name='Test author', title=prefix,
                          latitude='46', longitude='-117', is_public='true')

            async def sign_in(email):
                response = await client.post('/profileAccount', json={'email': email, 'password': password})
                assert response.status_code == 200, f'Sign-in returned {response.status_code}'
                return {'Authorization': 'Bearer ' + response.json()['session_token']}

            async def post(data, expected=200, headers=None):
                response = await client.post('/uploadForm', data=data, headers=headers)
                assert response.status_code == expected, response.text
                return response.json()

            owner_auth = await sign_in(owner_email)
            colleague_auth = await sign_in(colleague_email)
            admin_auth = await sign_in(admin_email)

            # A newly created account can name another account as its contact.
            card_id = (await post({**fields, 'contact_email': colleague_email}))['card_id']
            for path, params in (
                ('/allCards', {}), ('/allCardsByTag', {'categoryString': 'None'}), ('/getMarkers', {}),
                ('/searchBar', {'titleSearch': prefix}),
            ):
                response = await client.get(path, params=params)
                assert response.status_code == 200, response.text
                assert 'data' in response.json(), (path, response.text)
                card = next(card for card in response.json()['data'] if card['title'] == prefix)
                assert card['email'] == owner_email and card['contact_email'] == colleague_email
            print('PASS: new account uploads with another user as contact; listings retain both addresses')

            update = {**fields, 'update': 'true', 'original_username': owner,
                      'original_email': owner_email, 'original_title': prefix}
            external_email = 'unregistered-contact@example.invalid'
            await post({**update, 'contact_email': external_email, 'is_public': 'false'}, headers=owner_auth)
            await post({**update, 'is_public': 'false'}, headers=owner_auth)  # Legacy selector preserves contact.
            with connection, connection.cursor() as cursor:
                cursor.execute('SELECT UserID, ContactEmail, is_public FROM Cards WHERE CardID=%s', (card_id,))
                assert cursor.fetchone() == (user_id, external_email, False)
            for viewer_email, visible in ((owner_email, True), (colleague_email, False), (external_email, False)):
                response = await client.get('/allCards', params={'viewer_email': viewer_email})
                assert response.status_code == 200, response.text
                assert any(card['cardID'] == card_id for card in response.json()['data']) == visible
            await post({**update, 'contact_email': colleague_email}, 403, headers=colleague_auth)
            rejected = await client.delete('/deleteCard', params={'username': owner, 'title': prefix},
                                           headers=colleague_auth)
            assert rejected.status_code == 403, rejected.text
            await post({**fields, 'email': colleague_email}, 404)
            await post({**fields, 'contact_email': 'invalid'}, 422)
            print('PASS: contact edits persist; legacy updates preserve contact; contact grants no private visibility/edit/delete rights')

            transfer = {**update, 'cardID': str(card_id), 'username': colleague, 'email': colleague_email}
            await post(transfer, 401)
            await post(transfer, 403, headers=colleague_auth)
            await post(transfer, 403, headers=owner_auth)
            with connection, connection.cursor() as cursor:
                cursor.execute('SELECT UserID FROM Cards WHERE CardID=%s', (card_id,))
                assert cursor.fetchone() == (user_id,)
            await post(transfer, headers=admin_auth)
            with connection, connection.cursor() as cursor:
                cursor.execute('SELECT UserID FROM Cards WHERE CardID=%s', (card_id,))
                assert cursor.fetchone() == (user_id + 1,)
            new_selector = {'username': colleague, 'title': prefix, 'card_id': card_id}
            rejected = await client.delete('/deleteCard', params=new_selector, headers=owner_auth)
            assert rejected.status_code == 403, rejected.text
            deleted = await client.delete('/deleteCard', params=new_selector, headers=colleague_auth)
            assert deleted.status_code == 200, deleted.text
            print('PASS: only an authenticated admin transferred ownership; deletion follows the current owner')

            # The old upload contract remains usable and defaults the contact.
            legacy = await post({**fields, 'title': prefix + '_legacy'})
            with connection, connection.cursor() as cursor:
                cursor.execute('SELECT ContactEmail FROM Cards WHERE CardID=%s', (legacy['card_id'],))
                assert cursor.fetchone()[0] == owner_email
                cursor.execute('UPDATE Cards SET ContactEmail=NULL WHERE CardID=%s', (legacy['card_id'],))
            response = await client.get('/allCards')
            assert response.status_code == 200, response.text
            legacy_card = next(card for card in response.json()['data'] if card['cardID'] == legacy['card_id'])
            assert legacy_card['contact_email'] == owner_email
            print('PASS: legacy uploads default to the owner email; invalid account/contact requests are rejected')
    finally:
        with connection, connection.cursor() as cursor:
            cursor.execute(
                'SELECT CardID FROM Cards WHERE UserID IN (SELECT UserID FROM Users WHERE Username = ANY(%s))',
                (names,),
            )
            card_ids = [row[0] for row in cursor.fetchall()]
            for table in ('CardImages', 'CardPolygonVertices', 'CardTags', 'Files'):
                cursor.execute(f'DELETE FROM {table} WHERE CardID = ANY(%s)', (card_ids,))
            cursor.execute('DELETE FROM Cards WHERE CardID = ANY(%s)', (card_ids,))
            cursor.execute('DELETE FROM Users WHERE Username = ANY(%s)', (names,))
        connection.close()
        print('PASS: removed all contact test fixtures')


if __name__ == '__main__':
    asyncio.run(main())
