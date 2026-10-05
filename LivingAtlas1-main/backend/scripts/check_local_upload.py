"""Verify local single/batch uploads, serving, persistence and cleanup.

Run from backend: ./.venv-local/Scripts/python.exe scripts/check_local_upload.py
Uses only the guarded livingatlas_test database and loopback backend.
"""
import base64
import os
import sys
import uuid
from pathlib import Path

import psycopg2
import requests

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
from local_config import load_local_config


def main():
    load_local_config()
    assert os.getenv('LOCAL_TEST_MODE') == '1'
    assert os.getenv('DB_HOST') == '127.0.0.1' and os.getenv('DB_PORT') == '5433'
    assert os.getenv('DB_NAME') == 'livingatlas_test' and not os.getenv('DATABASE_URL')
    connection = psycopg2.connect(
        dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'], host=os.environ['DB_HOST'],
        port=os.environ['DB_PORT'], sslmode='disable', connect_timeout=5,
        application_name='codex_local_upload_verification',
    )
    prefix = f'local_upload_check_{uuid.uuid4().hex}'
    base_url = 'http://127.0.0.1:8000'
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=')
    card_id = None
    uploaded_urls = []
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute("SET lock_timeout='5s'")
            cursor.execute('SELECT current_database()')
            assert cursor.fetchone()[0] == 'livingatlas_test'
            cursor.execute('SELECT UserID FROM Users ORDER BY UserID LIMIT 1')
            user = cursor.fetchone()
            assert user, 'Create a local test user first'
            cursor.execute('SELECT CategoryID FROM Categories ORDER BY CategoryID LIMIT 1')
            category_id = cursor.fetchone()[0]
            cursor.execute('LOCK TABLE Cards IN SHARE ROW EXCLUSIVE MODE')
            cursor.execute('SELECT COALESCE(MAX(CardID),0)+1 FROM Cards')
            card_id = cursor.fetchone()[0]
            cursor.execute('INSERT INTO Cards (CardID,UserID,Title,CategoryID) VALUES (%s,%s,%s,%s)', (card_id, user[0], prefix, category_id))

        single = requests.post(base_url + '/uploadCardImage', data={'cardID': card_id, 'altText': prefix}, files={'image': ('fixture.png', png, 'image/png')}, timeout=15)
        assert single.status_code == 200, f'Single upload HTTP {single.status_code}'
        uploaded_urls.append(single.json()['imageURL'])
        batch = requests.post(base_url + '/uploadCardImages', data={'cardID': card_id}, files=[('images', ('fixture-a.png', png, 'image/png')), ('images', ('fixture-b.png', png, 'image/png'))], timeout=15)
        assert batch.status_code == 200, f'Batch upload HTTP {batch.status_code}'
        uploaded_urls.extend(image['imageURL'] for image in batch.json()['images'])

        gallery = requests.get(f'{base_url}/cardImages/{card_id}', timeout=15)
        assert gallery.status_code == 200
        images = gallery.json()['images']
        assert len(images) == 3 and [image['displayOrder'] for image in images] == [0, 1, 2]
        with connection, connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM CardImages WHERE CardID=%s', (card_id,))
            assert cursor.fetchone()[0] == 3
        for image in images:
            assert image['url'].startswith('/uploads/local_test/')
            served = requests.get(base_url + image['url'], timeout=15)
            assert served.status_code == 200 and served.content == png
            assert served.headers['content-type'].startswith('image/png')
            proxied = requests.get(f"{base_url}/cardImageProxy/{image['imageID']}", timeout=15)
            assert proxied.status_code == 200 and proxied.content == png
            deleted = requests.delete(f"{base_url}/deleteCardImage/{image['imageID']}", timeout=15)
            assert deleted.status_code == 200
            assert requests.get(base_url + image['url'], timeout=15).status_code == 404
        print('PASS: single + batch upload, 3 persisted image records, static serving, proxy and deletion')
    finally:
        if card_id is not None:
            # Query by this fixture's exact identity; never touch existing cards.
            with connection, connection.cursor() as cursor:
                cursor.execute('SELECT ImageURL FROM CardImages WHERE CardID=%s', (card_id,))
                uploaded_urls.extend(row[0] for row in cursor.fetchall())
                cursor.execute('DELETE FROM CardImages WHERE CardID=%s', (card_id,))
                cursor.execute('DELETE FROM Cards WHERE CardID=%s AND Title=%s', (card_id, prefix))
                cursor.execute('SELECT COUNT(*) FROM Cards WHERE Title=%s', (prefix,))
                assert cursor.fetchone()[0] == 0
                cursor.execute('SELECT COUNT(*) FROM CardImages WHERE CardID=%s', (card_id,))
                assert cursor.fetchone()[0] == 0
            root = (BACKEND_ROOT / 'uploads/local_test').resolve()
            for url in set(uploaded_urls):
                assert url.startswith('/uploads/local_test/')
                path = (BACKEND_ROOT / url.lstrip('/')).resolve()
                assert path.is_relative_to(root)
                path.unlink(missing_ok=True)
                assert not path.exists()
            print('PASS: zero fixture card/image rows and zero uploaded fixture files remain')
        connection.close()


if __name__ == '__main__':
    main()
