"""Local-only integration: previews, originals, framing, retry and deletion.
Run from backend: python -m scripts.check_image_workflow
"""
import asyncio
import io
import json
import os
import uuid
import httpx
from PIL import Image
from local_config import load_local_config


async def main():
    load_local_config()
    assert os.getenv('LOCAL_TEST_MODE') == '1' and not os.getenv('DATABASE_URL')
    assert (os.getenv('DB_HOST'), os.getenv('DB_PORT'), os.getenv('DB_NAME')) == ('127.0.0.1', '5433', 'livingatlas_test')
    from main import app
    from database import conn
    from endpoint_files import azure_storage
    name = 'image_workflow_' + uuid.uuid4().hex
    email = name + '@example.invalid'
    urls, card_id = [], None
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute('LOCK TABLE Users IN SHARE ROW EXCLUSIVE MODE')
            cursor.execute('SELECT COALESCE(MAX(UserID), 0)+1 FROM Users')
            user_id = cursor.fetchone()[0]
            cursor.execute('INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt) VALUES (%s,%s,%s,%s,%s)', (user_id, name, email, 'fixture', b'fixture'))
        raw = io.BytesIO()
        Image.new('RGB', (50000, 100), 'green').save(raw, format='PNG')
        data = raw.getvalue()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://local-test') as client:
            response = await client.post('/imagePreview', files={'image': ('panorama.png', data, 'image/png')})
            assert response.status_code == 200, response.text
            assert Image.open(io.BytesIO(response.content)).size == (4096, 8)
            fields = dict(username=name, email=email, title=name, name='Fixture author', latitude='46', longitude='-117', defer_images='true')
            response = await client.post('/uploadForm', data=fields)
            assert response.status_code == 200, response.text
            card_id = response.json()['card_id']
            with conn, conn.cursor() as cursor:
                cursor.execute('SELECT COUNT(*) FROM CardImages WHERE CardID=%s', (card_id,))
                assert cursor.fetchone()[0] == 0
            token = uuid.uuid4().hex
            response = await client.post('/uploadCardImage', data={'cardID': card_id, 'upload_token': token, 'presentation': '{"fit":"cover","x":80,"y":50,"zoom":1.5}'}, files={'image': ('panorama.png', data, 'image/png')})
            assert response.status_code == 200, response.text
            uploaded = response.json()
            image_id = uploaded['imageID']
            urls += [uploaded['url'], uploaded['original_url']]
            for url in urls:
                assert url.startswith('/uploads/local_test/')
                downloaded = await client.get(url)
                assert downloaded.status_code == 200
                if url == uploaded['original_url']:
                    assert downloaded.content == data
                else:
                    assert Image.open(io.BytesIO(downloaded.content)).size == (4096, 8)
            response = await client.post('/uploadCardImage', data={'cardID': card_id, 'upload_token': token}, files={'image': ('panorama.png', data, 'image/png')})
            assert response.status_code == 200 and response.json()['imageID'] == image_id, response.text
            response = await client.get(f'/cardImages/{card_id}')
            images = response.json()['images']
            assert len(images) == 1 and images[0]['presentation']['x'] == 80
            print('PASS: wide-image preview, immutable original, bounded derivative, and idempotent retry')
            edit = {**fields, 'update': 'true', 'original_username':name, 'original_email':email, 'original_title':name, 'requester_email':email,
                    'image_presentations': json.dumps({str(image_id): {'fit':'contain', 'x':50, 'y':50, 'zoom':1}})}
            response = await client.post('/uploadForm', data=edit)
            assert response.status_code == 200, response.text
            for endpoint, params in [('/allCards', {}), ('/searchBar', {'titleSearch':name}), ('/allCardsByTag', {'categoryString':'None'})]:
                response = await client.get(endpoint, params=params)
                assert response.status_code == 200, response.text
                record = next(card for card in response.json()['data'] if card['cardID'] == card_id)
                assert record['images'][0]['presentation']['fit'] == 'contain'
                assert record['images'][0]['original_url'] == uploaded['original_url']
            response = await client.post('/uploadForm', data={**edit, 'image_presentations':'{"2147483647":{"fit":"cover"}}'})
            assert response.status_code == 422
            response = await client.get(f'/cardImages/{card_id}')
            assert response.json()['images'][0]['presentation']['fit'] == 'contain'
            print('PASS: framing persists across listing APIs; invalid ownership rolls back')
            response = await client.delete(f'/deleteCardImage/{image_id}')
            assert response.status_code == 200, response.text
            for url in urls:
                assert (await client.get(url)).status_code == 404
            print('PASS: deleting an image removes its display and original assets')
    finally:
        with conn, conn.cursor() as cursor:
            cursor.execute('SELECT ImageURL, OriginalURL FROM CardImages WHERE CardID=%s', (card_id,))
            for display, original in cursor.fetchall():
                urls.extend([display, original])
            for table in ('CardImages', 'CardPolygonVertices', 'CardTags', 'Files'):
                cursor.execute(f'DELETE FROM {table} WHERE CardID=%s', (card_id,))
            cursor.execute('DELETE FROM Cards WHERE CardID=%s AND Title=%s', (card_id, name))
            cursor.execute('DELETE FROM Users WHERE Username=%s', (name,))
        for url in set(urls):
            if url:
                assert url.startswith('/uploads/local_test/')
                azure_storage.delete_from_url(url)
        print('PASS: removed all workflow fixtures and files')


if __name__ == '__main__':
    asyncio.run(main())
