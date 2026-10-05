"""Local-only default cover lifecycle check; removes its own fixture afterward."""
import base64
import os
import sys
import uuid
from pathlib import Path

import psycopg2
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from local_config import load_local_config


def main():
    load_local_config()
    assert os.getenv('LOCAL_TEST_MODE') == '1' and not os.getenv('DATABASE_URL')
    assert os.getenv('DB_HOST') == '127.0.0.1' and os.getenv('DB_PORT') == '5433' and os.getenv('DB_NAME') == 'livingatlas_test'
    conn = psycopg2.connect(dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'], host=os.environ['DB_HOST'], port=os.environ['DB_PORT'], sslmode='disable', application_name='codex_default_cover_verification')
    base = 'http://127.0.0.1:8000'
    title = 'default_cover_check_' + uuid.uuid4().hex
    image_url = None
    try:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT Username, Email FROM Users ORDER BY UserID LIMIT 1')
            username, email = cur.fetchone()
        fields = {'title': title, 'username': username, 'email': email, 'name': 'Fixture', 'category': 'Other', 'latitude': '46', 'longitude': '-117'}
        created = requests.post(base + '/uploadForm', data=fields, timeout=15)
        assert created.status_code == 200, f'Create HTTP {created.status_code}'
        card_id = created.json()['card_id']
        gallery = requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()['images']
        assert len(gallery) == 1 and gallery[0]['imageID'] > 0
        default = gallery[0]
        assert default['url'].endswith('/thumbnails/default_cereo_thumbnail.png')
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=')
        uploaded = requests.post(base + '/uploadCardImage', data={'cardID': card_id}, files={'image': ('fixture.png', png, 'image/png')}, timeout=15)
        assert uploaded.status_code == 200
        new_id, image_url = uploaded.json()['imageID'], uploaded.json()['imageURL']
        gallery = requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()['images']
        assert [image['imageID'] for image in gallery] == [default['imageID'], new_id]
        with conn, conn.cursor() as cur:
            cur.execute('SELECT Thumbnail_Link FROM Cards WHERE CardID=%s', (card_id,))
            assert cur.fetchone()[0] == default['url']
        assert requests.delete(f"{base}/deleteCardImage/{default['imageID']}", timeout=15).status_code == 200
        assert requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()['images'][0]['imageID'] == new_id
        assert requests.delete(f'{base}/deleteCardImage/{new_id}', timeout=15).status_code == 200
        assert requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()['images'] == []
        updated = requests.post(base + '/uploadForm', data={**fields, 'update': 'true', 'original_username': username, 'original_email': email, 'original_title': title}, timeout=15)
        assert updated.status_code == 200
        with conn, conn.cursor() as cur:
            cur.execute('SELECT Thumbnail_Link FROM Cards WHERE CardID=%s', (card_id,))
            assert cur.fetchone()[0] == ''
            cur.execute('SELECT COUNT(*) FROM CardImages WHERE CardID=%s', (card_id,))
            assert cur.fetchone()[0] == 0
        print('PASS: default cover has an ID; upload appends and preserves cover; explicit deletion and later metadata save keep gallery empty')
    finally:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT i.ImageURL FROM CardImages i JOIN Cards c ON c.CardID=i.CardID WHERE c.Title=%s', (title,))
            files = [row[0] for row in cur.fetchall()]
            if image_url:
                files.append(image_url)
            cur.execute('DELETE FROM CardImages WHERE CardID IN (SELECT CardID FROM Cards WHERE Title=%s)', (title,))
            cur.execute('DELETE FROM Cards WHERE Title=%s', (title,))
            cur.execute('SELECT COUNT(*) FROM Cards WHERE Title=%s', (title,))
            assert cur.fetchone()[0] == 0
        storage_root = (ROOT / 'uploads/local_test').resolve()
        for url in files:
            if url.startswith('/uploads/local_test/'):
                file = (ROOT / url.lstrip('/')).resolve()
                assert file.is_relative_to(storage_root)
                file.unlink(missing_ok=True)
        conn.close()
        print('PASS: fixture records and local files cleaned up; existing user cards untouched')


if __name__ == '__main__':
    main()
