"""Verify card deletion against the isolated local backend and PostgreSQL.

Run from backend: python -m scripts.check_card_deletion
Use --baseline to exercise the username/title request without a card ID.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from hashlib import sha256
from pathlib import Path
from secrets import token_urlsafe
from urllib.parse import unquote
from uuid import uuid4

import requests

from load_tests.common import API_BASE, db_connect, require_local_target
from sessions import hash_password


def main(baseline=False):
    require_local_target()
    prefix = 'delete_check_' + uuid4().hex
    owner, admin, unrelated = (f'{prefix}_{role}' for role in ('owner', 'admin', 'unrelated'))
    owner_email, admin_email, unrelated_email = (f'{user}@example.invalid' for user in (owner, admin, unrelated))
    title = prefix
    password = token_urlsafe(20)
    salt = uuid4().bytes
    hashed_password = hash_password(password, salt)
    local_dir = Path(__file__).resolve().parents[1] / 'uploads' / 'local_test' / 'images'
    paths = [
        local_dir / f'{prefix}_{asset}'
        for asset in ('cover.webp', 'original.png', 'first.csv', 'second.csv', 'shared.csv')
    ]
    urls = [f'/uploads/local_test/images/{path.name}' for path in paths]

    def authorization(token):
        return {'Authorization': f'Bearer {token}'} if token else {}

    def login(email, selected_password=password, previous_token=None):
        response = requests.post(
            f'{API_BASE}/profileAccount', json={'email': email, 'password': selected_password},
            headers=authorization(previous_token), timeout=10,
        )
        assert response.status_code == 200, f'Login returned HTTP {response.status_code}'
        assert response.headers.get('Cache-Control') == 'no-store'
        return response.json()['session_token']

    def delete(token, **selector):
        return requests.delete(
            f'{API_BASE}/deleteCard', params=selector, headers=authorization(token), timeout=10,
        )

    def change_role(token, email, is_admin):
        return requests.post(
            f'{API_BASE}/edit_user_role', json={'email': email, 'is_admin': is_admin},
            headers=authorization(token), timeout=10,
        )

    with closing(db_connect()) as db:
        has_favorites = False
        try:
            with db, db.cursor() as cursor:
                cursor.execute("SELECT to_regclass('favorites') IS NOT NULL")
                has_favorites = cursor.fetchone()[0]
                print(f'Favorites table present: {has_favorites}', flush=True)
                cursor.execute('LOCK TABLE Users, Cards, Files IN SHARE ROW EXCLUSIVE MODE')
                cursor.execute('SELECT COALESCE(MAX(UserID), 0) + 1 FROM Users')
                owner_id = cursor.fetchone()[0]
                cursor.executemany(
                    'INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt, Is_Admin) '
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    [(owner_id, owner, owner_email, hashed_password, salt, False),
                     (owner_id + 1, admin, admin_email, hashed_password, salt, True),
                     (owner_id + 2, unrelated, unrelated_email, hashed_password, salt, False)],
                )
                cursor.execute('SELECT COALESCE(MAX(CardID), 0) + 1 FROM Cards')
                card_id = cursor.fetchone()[0]
                cursor.execute(
                    'INSERT INTO Cards (CardID, UserID, Title, Thumbnail_Link) VALUES (%s, %s, %s, %s)',
                    (card_id, owner_id, title, urls[0] if not baseline else ''),
                )
                if not baseline:
                    cursor.execute('INSERT INTO Cards (CardID, UserID, Title) VALUES (%s, %s, %s)',
                                   (card_id + 1, owner_id, title))
                    cursor.execute('INSERT INTO Favorites (UserID, CardID) VALUES (%s, %s)',
                                   (owner_id + 1, card_id))
                    cursor.execute('INSERT INTO CardImages (CardID, ImageURL, OriginalURL) VALUES (%s, %s, %s)',
                                   (card_id, *urls[:2]))
                    cursor.execute('SELECT COALESCE(MAX(FileID), 0) + 1 FROM Files')
                    file_id = cursor.fetchone()[0]
                    files = [(file_id + i, card_id, url) for i, url in enumerate(urls[2:])]
                    files.append((file_id + len(files), card_id + 1, urls[-1]))
                    cursor.executemany('INSERT INTO Files (FileID, CardID, File_Link) VALUES (%s, %s, %s)', files)

            lookup = dict(username=owner, title=title)
            admin_token = login(admin_email)
            if baseline:
                response = delete(admin_token, **lookup)
                print(f'Admin delete returned {response.status_code}: {response.text}', flush=True)
                response.raise_for_status()
                return

            local_dir.mkdir(parents=True, exist_ok=True)
            for path in paths:
                path.write_bytes(b'isolated card deletion fixture')
            owner_token = login(owner_email)
            unrelated_token = login(unrelated_email)
            target = dict(card_id=card_id, **lookup)
            assert delete(admin_token, **lookup).status_code == 409
            assert delete(unrelated_token, **target).status_code == 403
            assert delete(None, **target).status_code == 401
            assert delete(token_urlsafe(32), **target).status_code == 401
            assert delete(admin_token, card_id=card_id, username=owner, title='Stale title').status_code == 404
            assert requests.post(f'{API_BASE}/list_database', headers=authorization(unrelated_token),
                                 timeout=10).status_code == 403

            assert change_role(None, owner_email, False).status_code == 401
            assert change_role(unrelated_token, owner_email, False).status_code == 403
            assert change_role(admin_token, unrelated_email, True).status_code == 200
            assert change_role(unrelated_token, admin_email, False).status_code == 200
            assert delete(admin_token, **target).status_code == 403, 'A demoted account kept admin deletion permission'
            assert change_role(unrelated_token, admin_email, True).status_code == 200
            assert change_role(admin_token, unrelated_email, False).status_code == 200

            expired_token = login(unrelated_email)
            with db, db.cursor() as cursor:
                cursor.execute(
                    "UPDATE AccountTokens SET ExpiresAt = statement_timestamp() - interval '1 second' WHERE TokenHash = %s",
                    (sha256(expired_token.encode()).hexdigest(),),
                )
                assert cursor.rowcount == 1
            assert delete(expired_token, **target).status_code == 401
            other_admin_token = login(admin_email)
            switched_token = login(unrelated_email, previous_token=other_admin_token)
            assert delete(other_admin_token, **target).status_code == 401
            assert delete(switched_token, **target).status_code == 403
            assert requests.delete(f'{API_BASE}/session', headers=authorization(switched_token), timeout=10).status_code == 204
            assert delete(switched_token, **target).status_code == 401
            print('PASS: regular user 403; missing, invalid, expired, switched-out and signed-out sessions 401; '
                  'only a current admin can change roles and demotion takes effect immediately')
            assert all(path.is_file() for path in paths)
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda _: delete(admin_token, **target), range(2)))
            assert sorted(response.status_code for response in responses) == [200, 404], [
                response.text for response in responses
            ]
            with db, db.cursor() as cursor:
                cursor.execute('SELECT CardID FROM Cards WHERE UserID = %s', (owner_id,))
                assert cursor.fetchall() == [(card_id + 1,)]
                for table in ('Favorites', 'CardImages', 'Files'):
                    cursor.execute(f'SELECT COUNT(*) FROM {table} WHERE CardID = %s', (card_id,))
                    assert cursor.fetchone()[0] == 0, table
            assert not any(path.exists() for path in paths[:-1])
            assert paths[-1].exists(), 'The other card still references the shared file'
            assert delete(owner_token, **lookup).status_code == 200
            assert not paths[-1].exists()
            print('PASS: admin and owner deletion, duplicate titles, stale lookup, permission denial, '
                  'concurrent requests and shared asset preservation')

            attachment_ids = []
            for i in range(2):
                response = requests.post(
                    f'{API_BASE}/uploadForm',
                    data=dict(username=owner, email=owner_email, name='Fixture author',
                              title=f'{title}_{i}', latitude='46', longitude='-117'),
                    files={'files': (f'{prefix}.csv', f'value\n{i}\n', 'text/csv')},
                    timeout=15,
                )
                assert response.status_code == 200 and response.json().get('card_id'), response.text
                attachment_ids.append(response.json()['card_id'])
            with db, db.cursor() as cursor:
                cursor.execute('SELECT File_Link FROM Files WHERE CardID = ANY(%s) ORDER BY CardID',
                               (attachment_ids,))
                links = [row[0] for row in cursor.fetchall()]
            assert len(set(links)) == 2, 'New uploads with the same filename must have distinct storage keys'
            new_password = token_urlsafe(20)
            changed_password = requests.post(
                f'{API_BASE}/reset-password', json={'new_password': new_password},
                headers=authorization(owner_token), timeout=10,
            )
            assert changed_password.status_code == 200 and changed_password.json()['success']
            assert delete(owner_token, card_id=attachment_ids[0], username=owner, title=f'{title}_0').status_code == 401
            old_login = requests.post(
                f'{API_BASE}/profileAccount', json={'email': owner_email, 'password': password}, timeout=10,
            )
            assert old_login.status_code == 401
            owner_token = login(owner_email, new_password)
            assert delete(owner_token, card_id=attachment_ids[0], username=owner, title=f'{title}_0').status_code == 200
            assert requests.get(f'{API_BASE}{links[0]}', timeout=10).status_code == 404
            assert requests.get(f'{API_BASE}{links[1]}', timeout=10).status_code == 200
            assert delete(owner_token, card_id=attachment_ids[1], username=owner, title=f'{title}_1').status_code == 200
            print('PASS: changing a password revoked earlier sessions; deleting an upload preserves the other upload')
        finally:
            with db, db.cursor() as cursor:
                cursor.execute(
                    'SELECT CardID FROM Cards WHERE UserID IN (SELECT UserID FROM Users WHERE Username = %s)',
                    (owner,),
                )
                remaining_ids = [row[0] for row in cursor.fetchall()]
                if has_favorites:
                    cursor.execute('DELETE FROM Favorites WHERE CardID = ANY(%s)', (remaining_ids,))
                cursor.execute('DELETE FROM Files WHERE CardID = ANY(%s) RETURNING File_Link', (remaining_ids,))
                for (url,) in cursor.fetchall():
                    if url and url.startswith(f'/uploads/local_test/images/files/{owner}/'):
                        path = (local_dir / unquote(url.removeprefix('/uploads/local_test/images/'))).resolve()
                        if path.is_relative_to((local_dir / 'files' / owner).resolve()):
                            paths.append(path)
                cursor.execute('DELETE FROM Cards WHERE CardID = ANY(%s)', (remaining_ids,))
                cursor.execute('DELETE FROM Users WHERE Username = ANY(%s)', ([owner, admin, unrelated],))
                cursor.execute('SELECT COUNT(*) FROM Users WHERE Username = ANY(%s)', ([owner, admin, unrelated],))
                assert cursor.fetchone()[0] == 0
            for path in paths:
                path.unlink(missing_ok=True)
            print('PASS: removed all card deletion fixtures', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', action='store_true')
    main(parser.parse_args().baseline)
