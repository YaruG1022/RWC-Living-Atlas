"""Verify selected gallery images against the dedicated local database only."""
import base64
import json
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
    assert (os.getenv('DB_HOST'), os.getenv('DB_PORT'), os.getenv('DB_NAME')) == ('127.0.0.1', '5433', 'livingatlas_test')
    conn = psycopg2.connect(dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'], host=os.environ['DB_HOST'], port=os.environ['DB_PORT'], sslmode='disable', application_name='codex_gallery_selection_check')
    base = 'http://127.0.0.1:8000'
    title = 'gallery_selection_check_' + uuid.uuid4().hex
    files = []
    try:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT Username, Email FROM Users ORDER BY UserID LIMIT 1')
            username, email = cur.fetchone()
        fields = {'title': title, 'username': username, 'email': email, 'name': 'Fixture', 'category': 'Other', 'latitude': '46', 'longitude': '-117'}
        created = requests.post(base + '/uploadForm', data=fields, timeout=15)
        assert created.status_code == 200, f'Create HTTP {created.status_code}'
        card_id = created.json()['card_id']
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=')
        upload = requests.post(base + '/uploadCardImages', data={'cardID': card_id}, files=[('images', (f'fixture-{i}.png', png, 'image/png')) for i in range(7)], timeout=30)
        assert upload.status_code == 200, f'Upload HTTP {upload.status_code}'
        gallery = requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()
        files = [image['url'] for image in gallery['images']]
        ids = [image['imageID'] for image in gallery['images']]
        assert len(ids) == 8 and gallery['galleryImageIDs'] is None
        for endpoint, count in (('/uploadCardImage', 1), ('/uploadCardImages', 21)):
            field = 'image' if count == 1 else 'images'
            added = requests.post(base + endpoint, data={'cardID': card_id}, files=[(field, (f'extra-{i}.png', png, 'image/png')) for i in range(count)], timeout=30)
            assert added.status_code == 200, f'{endpoint} HTTP {added.status_code}'
        gallery = requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()
        files = [image['url'] for image in gallery['images']]
        ids = [image['imageID'] for image in gallery['images']]
        assert len(ids) == 30
        for endpoint, field in (('/uploadCardImage', 'image'), ('/uploadCardImages', 'images')):
            rejected = requests.post(base + endpoint, data={'cardID': card_id}, files=[(field, ('overflow.png', png, 'image/png'))], timeout=15)
            assert rejected.status_code == 422 and 'at most 30 images' in rejected.json()['detail']
        print('PASS: uploads beyond eight reach 30; single and batch uploads reject image 31')
        chosen = [ids[7], ids[2], ids[6], ids[3], ids[5], ids[4]]
        cover_url = next(image['url'] for image in gallery['images'] if image['imageID'] == chosen[0])
        update_fields = {**fields, 'update': 'true', 'original_username': username, 'original_email': email, 'original_title': title, 'requester_email': email}
        for layout in ('multi', 'slideshow'):
            saved = requests.post(base + '/uploadForm', data={**update_fields, 'gallery_layout': layout, 'gallery_image_ids': json.dumps(chosen)}, timeout=15)
            assert saved.status_code == 200, f'Save HTTP {saved.status_code}'
            gallery = requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()
            assert gallery['galleryLayout'] == layout and gallery['galleryImageIDs'] == chosen
            assert [image['imageID'] for image in gallery['images']] == ids
            with conn, conn.cursor() as cur:
                cur.execute('SELECT GalleryImageIDs, Thumbnail_Link FROM Cards WHERE CardID=%s', (card_id,))
                assert cur.fetchone() == (chosen, cover_url)
        reordered = requests.put(f'{base}/reorderCardImages?cardID={card_id}', json=list(reversed(ids)), timeout=15)
        assert reordered.status_code == 200
        with conn, conn.cursor() as cur:
            cur.execute('SELECT GalleryImageIDs, Thumbnail_Link FROM Cards WHERE CardID=%s', (card_id,))
            assert cur.fetchone() == (chosen, cover_url)
        listing = requests.get(base + '/allCards', timeout=15).json()['data']
        assert next(card for card in listing if card['cardID'] == card_id)['gallery_image_ids'] == chosen
        assert requests.post(base + '/uploadForm', data=update_fields, timeout=15).status_code == 200
        assert requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()['galleryImageIDs'] == chosen
        for invalid in (ids[:7], [ids[0], ids[0]], [2147483647]):
            rejected = requests.post(base + '/uploadForm', data={**update_fields, 'gallery_image_ids': json.dumps(invalid)}, timeout=15)
            assert rejected.status_code == 422
            assert requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()['galleryImageIDs'] == chosen
        assert requests.post(base + '/uploadForm', data={**update_fields, 'gallery_image_ids': '[]'}, timeout=15).status_code == 200
        gallery = requests.get(f'{base}/cardImages/{card_id}', timeout=15).json()
        assert gallery['galleryImageIDs'] == [] and len(gallery['images']) == 30
        print('PASS: six-image selection persists for both modes, survives metadata saves, rejects invalid IDs/counts, and supports empty selection without deleting images')
    finally:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT i.ImageURL FROM CardImages i JOIN Cards c ON c.CardID=i.CardID WHERE c.Title=%s', (title,))
            files += [row[0] for row in cur.fetchall()]
            cur.execute('DELETE FROM CardImages WHERE CardID IN (SELECT CardID FROM Cards WHERE Title=%s)', (title,))
            cur.execute('DELETE FROM Cards WHERE Title=%s', (title,))
            cur.execute('SELECT COUNT(*) FROM Cards WHERE Title=%s', (title,))
            assert cur.fetchone()[0] == 0
        storage_root = (ROOT / 'uploads/local_test').resolve()
        for url in set(files):
            if url.startswith('/uploads/local_test/'):
                file = (ROOT / url.lstrip('/')).resolve()
                assert file.is_relative_to(storage_root)
                file.unlink(missing_ok=True)
                assert not file.exists()
        conn.close()
        print('PASS: fixture records and local files removed; existing cards untouched')


if __name__ == '__main__':
    main()
