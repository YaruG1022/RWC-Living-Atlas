"""Small local-only attachment upload/download regression with complete cleanup."""
import io
import json
import os
import uuid
import zipfile
import requests
import psycopg2
from local_config import load_local_config


def main():
    load_local_config()
    assert (os.getenv('LOCAL_TEST_MODE'), os.getenv('DB_HOST'), os.getenv('DB_PORT'), os.getenv('DB_NAME')) == ('1', '127.0.0.1', '5433', 'livingatlas_test')
    assert not os.getenv('DATABASE_URL')
    from endpoint_files import azure_storage
    connection = psycopg2.connect(host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT'), dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), application_name='codex_attachment_check')
    prefix = 'attachment_check_' + uuid.uuid4().hex
    base = 'http://127.0.0.1:8000'
    urls = []
    card_id = None
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_database()')
            assert cursor.fetchone()[0] == 'livingatlas_test'
            cursor.execute('SELECT username,email FROM Users ORDER BY UserID LIMIT 1')
            username, email = cursor.fetchone()
        filenames = [prefix + '-重要.txt', prefix + '-notes.txt']
        tokens = [str(uuid.uuid4()), str(uuid.uuid4())]
        description = '<p>' + ' '.join(f'<a href="#pending-file-{token}">{filename}</a>' for token, filename in zip(tokens, filenames)) + '</p>'
        response = requests.post(base + '/uploadForm', data={'title': prefix, 'username': username, 'email': email, 'name': 'Local attachment check', 'category': 'Other', 'latitude': '46', 'longitude': '-120', 'description': description, 'description_file_tokens': json.dumps(tokens)}, files=[('files', (name, b'attachment-regression', 'text/plain')) for name in filenames], timeout=30)
        assert response.status_code == 200, f'Upload HTTP {response.status_code}: {response.json().get("detail", "no detail")}'
        with connection.cursor() as cursor:
            cursor.execute('SELECT CardID FROM Cards WHERE Title=%s', (prefix,))
            card_id = cursor.fetchone()[0]
            cursor.execute('SELECT fileid,file_link FROM Files WHERE CardID=%s ORDER BY fileid', (card_id,))
            rows = cursor.fetchall()
        assert len(rows) == 2
        with connection.cursor() as cursor:
            cursor.execute('SELECT description FROM Cards WHERE cardid=%s', (card_id,))
            saved_description = cursor.fetchone()[0]
        assert '#pending-file-' not in saved_description
        assert all(f'/downloadFile?fileID={file_id}' in saved_description for file_id, _ in rows)
        urls = [url for _, url in rows]
        assert all(url.startswith(azure_storage.LOCAL_URL_PREFIX) for url in urls)
        for (file_id, _), filename in zip(rows, filenames):
            downloaded = requests.get(base + '/downloadFile', params={'fileID': file_id}, timeout=15)
            assert downloaded.status_code == 200
            assert downloaded.headers['Content-Disposition'].startswith('attachment;')
            with zipfile.ZipFile(io.BytesIO(downloaded.content)) as archive:
                assert archive.read(filename) == b'attachment-regression'
        # Reproduce a pre-fix record without modifying any user's existing attachment.
        from urllib.parse import unquote
        legacy_url = azure_storage.build_url(unquote(urls[0].split('/images/', 1)[1]))
        with connection, connection.cursor() as cursor:
            cursor.execute('UPDATE Files SET file_link=%s WHERE fileid=%s', (legacy_url, rows[0][0]))
        legacy = requests.get(base + '/downloadFile', params={'fileID': rows[0][0]}, timeout=15)
        assert legacy.status_code == 200 and legacy.headers['Content-Disposition'].startswith('attachment;')
        assert requests.get(base + '/downloadFile', params={'fileID': -1}, timeout=15).status_code == 404
        print('PASS: two TXT uploads, saved description download links, local persisted URLs, ZIP bytes/content, Unicode download name, legacy-link recovery, missing-ID 404')
    finally:
        with connection, connection.cursor() as cursor:
            cursor.execute('SELECT CardID FROM Cards WHERE Title=%s', (prefix,))
            row = cursor.fetchone()
            if row:
                card_id = row[0]
                cursor.execute('SELECT file_link FROM Files WHERE CardID=%s', (card_id,))
                urls.extend(url[0] for url in cursor.fetchall())
                cursor.execute('DELETE FROM Files WHERE CardID=%s', (card_id,))
                cursor.execute('DELETE FROM Cards WHERE CardID=%s AND Title=%s', (card_id, prefix))
        for url in set(urls):
            azure_storage.delete_from_url(url)
            if url.startswith(azure_storage.LOCAL_URL_PREFIX):
                from urllib.parse import unquote
                container, blob = unquote(url[len(azure_storage.LOCAL_URL_PREFIX):]).split('/', 1)
                assert not azure_storage._local_blob_path(blob, container).exists()
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM Cards WHERE Title=%s', (prefix,))
            assert cursor.fetchone()[0] == 0
            if card_id:
                cursor.execute('SELECT COUNT(*) FROM Files WHERE CardID=%s', (card_id,))
                assert cursor.fetchone()[0] == 0
        connection.close()
        print('CLEANUP: zero fixture card/file rows; local uploaded fixture files removed')


if __name__ == '__main__':
    main()

