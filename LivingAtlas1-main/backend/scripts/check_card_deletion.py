"""Verify card deletion against the isolated local backend and PostgreSQL.

Run from backend: python -m scripts.check_card_deletion
Use --baseline to exercise the original username/title request.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4

import requests

from load_tests.common import API_BASE, db_connect, require_local_target


def main(baseline=False):
    require_local_target()
    prefix = 'delete_check_' + uuid4().hex
    owner, admin, unrelated = (f'{prefix}_{role}' for role in ('owner', 'admin', 'unrelated'))
    owner_email, admin_email, unrelated_email = (f'{user}@example.invalid' for user in (owner, admin, unrelated))
    title = prefix
    local_dir = Path(__file__).resolve().parents[1] / 'uploads' / 'local_test' / 'images'
    paths = [
        local_dir / f'{prefix}_{asset}'
        for asset in ('cover.webp', 'original.png', 'first.csv', 'second.csv', 'shared.csv')
    ]
    urls = [f'/uploads/local_test/images/{path.name}' for path in paths]

    def delete(email, **selector):
        return requests.delete(
            f'{API_BASE}/deleteCard', params={**selector, 'requester_email': email}, timeout=10,
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
                    "VALUES (%s, %s, %s, 'unused-test-hash', %s, %s)",
                    [(owner_id, owner, owner_email, b'fixture', False),
                     (owner_id + 1, admin, admin_email, b'fixture', True),
                     (owner_id + 2, unrelated, unrelated_email, b'fixture', False)],
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
            if baseline:
                response = delete(admin_email, **lookup)
                print(f'Admin delete returned {response.status_code}: {response.text}', flush=True)
                response.raise_for_status()
                return

            local_dir.mkdir(parents=True, exist_ok=True)
            for path in paths:
                path.write_bytes(b'isolated card deletion fixture')
            assert delete(admin_email, **lookup).status_code == 409
            assert delete(unrelated_email, card_id=card_id, **lookup).status_code == 403
            assert delete('', card_id=card_id, **lookup).status_code == 403
            assert delete(admin_email, card_id=card_id, username=owner, title='Stale title').status_code == 404
            assert all(path.is_file() for path in paths)
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda _: delete(admin_email, card_id=card_id, **lookup), range(2)))
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
            assert delete(owner_email, **lookup).status_code == 200
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
            assert delete(owner_email, card_id=attachment_ids[0], username=owner, title=f'{title}_0').status_code == 200
            assert requests.get(f'{API_BASE}{links[0]}', timeout=10).status_code == 404
            assert requests.get(f'{API_BASE}{links[1]}', timeout=10).status_code == 200
            assert delete(owner_email, card_id=attachment_ids[1], username=owner, title=f'{title}_1').status_code == 200
            print('PASS: deleting an uploaded file preserves the other upload with the same filename')
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
