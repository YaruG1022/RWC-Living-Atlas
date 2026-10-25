"""Small, isolated HTTP/DB regression for concurrent custom-library operations.

Run against a local backend after restarting it with the changed code. Never
targets production; all fixtures use a unique email and are removed in finally.
"""
import json
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from custom_layer_schema import ensure_custom_layer_schema
from load_tests.common import db_connect, require_local_target, summary, timed_request


def check_legacy_migration():
    schema = 'custom_layer_migration_' + uuid.uuid4().hex
    connection = db_connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE SCHEMA {schema}')
            cursor.execute(f'SET LOCAL search_path TO {schema}')
            cursor.execute("""
                CREATE TABLE user_custom_layers (
                    id SERIAL PRIMARY KEY, user_email VARCHAR(255) NOT NULL,
                    service_key VARCHAR(255) NOT NULL, label VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL, folder VARCHAR(255) DEFAULT 'Root',
                    type VARCHAR(50) NOT NULL DEFAULT 'MapServer', state VARCHAR(50) DEFAULT '',
                    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (user_email, service_key)
                );
                INSERT INTO user_custom_layers (user_email,service_key,label,url)
                VALUES ('legacy@example.invalid','legacy','Keep me','https://example.invalid');
            """)
            ensure_custom_layer_schema(cursor)
            cursor.execute("UPDATE user_custom_layers SET geojson='{}', layer_order='[2,1]', sort_order=7")
            ensure_custom_layer_schema(cursor)
            cursor.execute('SELECT label, geojson, layer_order, sort_order FROM user_custom_layers')
            assert cursor.fetchall() == [('Keep me', '{}', '[2,1]', 7)]
            cursor.execute('SELECT COUNT(*) FROM user_custom_folders')
            assert cursor.fetchone()[0] == 0
    finally:
        connection.rollback()  # Removes the entire fixture schema, even on failure.
        connection.close()
    with db_connect() as connection, connection.cursor() as cursor:
        cursor.execute('SELECT COUNT(*) FROM pg_namespace WHERE nspname=%s', (schema,))
        assert cursor.fetchone()[0] == 0
    print('PASS: legacy migration is repeatable, preserves data, and leaves no fixture schema', flush=True)


def main():
    require_local_target()
    check_legacy_migration()
    email = 'custom-layer-regression-' + uuid.uuid4().hex + '@example.invalid'
    geometry = {'type':'FeatureCollection', 'features':[]}
    payload = dict(user_email=email, service_key='probe', label='Probe',
                   url='uploaded://probe', type='uploaded', folder='Probe/Water',
                   geojson=json.dumps(geometry))
    results = []

    def request(method, path, expected=200, **kwargs):
        result = timed_request(method, '/arcgis'+path, **kwargs)
        assert result['status'] == expected, result
        if expected == 200:
            assert result['ok'], result
            results.append(result)
        return result['body']

    def operation(kind):
        if kind == 'save':
            return request('POST', '/custom-layers/save', json=payload)
        return request('GET', '/custom-layers' if kind == 'layers' else '/custom-folders', params={'user_email':email})

    try:
        for _ in range(3):
            operation('save')
        # Same four-request overlap that failed before this fix: 5 batches,
        # 10 idempotent saves plus 10 library/folder reads, concurrency 4.
        for _ in range(5):
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(operation, ['save','save','layers','folders']))
        print('PASS: original overlap regression, 20/20 HTTP requests succeeded', flush=True)

        def save_distinct(index):
            return request('POST', '/custom-layers/save', json={**payload, 'service_key':f'probe-{index}'})
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(save_distinct, range(8)))

        # Re-saving metadata must retain uploaded features and layer ordering.
        request('PUT','/custom-layers/layer-order',json={'user_email':email,'service_key':'probe','layer_order':[2,1]})
        request('POST','/custom-layers/save',json={**payload,'label':'Renamed probe','geojson':None})
        stored = request('GET','/custom-layers/geojson',params={'user_email':email,'service_key':'probe'})
        assert stored['geojson'] == geometry
        request('POST','/custom-folders',json={'user_email':email,'folder_name':'Empty folder'})
        request('PUT','/custom-folders/rename',json={'user_email':email,'old_name':'Probe/Water','new_name':'Probe/Rivers'})
        request('PUT','/custom-layers/reorder',json={'user_email':email,'order':[{'service_key':'probe','sort_order':17,'folder':'Root'}]})
        rows = operation('layers')
        assert len(rows) == 9 and len({r['key'] for r in rows}) == 9, rows
        main_row = next(r for r in rows if r['key'] == 'probe')
        assert main_row['label'] == 'Renamed probe' and main_row['folder'] == 'Root'
        assert main_row['sort_order'] == 17 and json.loads(main_row['layer_order']) == [2,1]
        assert all(r['folder'] == 'Probe/Rivers' for r in rows if r['key'] != 'probe')
        with db_connect() as connection, connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*), COUNT(DISTINCT service_key) FROM user_custom_layers WHERE user_email=%s',(email,))
            assert cursor.fetchone() == (9,9)
        request('GET','/custom-layers/geojson',expected=404,params={'user_email':email,'service_key':'missing'})
        request('POST','/custom-layers/save',expected=400,json={**payload,'service_key':' '})
        request('DELETE','/custom-folders',json={'user_email':email,'folder_name':'Probe/Rivers'})
        assert all(r['folder'] == 'Root' for r in operation('layers'))
        request('DELETE','/custom-layers',json={'user_email':email,'service_key':'probe-0'})
        assert len(operation('layers')) == 8
        print('PASS: unique saves, metadata/GeoJSON preservation, folders, ordering, deletion, and recovery after 400/404', flush=True)
        print(json.dumps({'functional_sample':summary(results),'expected_rejections':{'400':1,'404':1}},indent=2),flush=True)
    finally:
        with db_connect() as connection, connection.cursor() as cursor:
            for table in ('user_custom_layers','user_custom_folders'):
                cursor.execute(f'DELETE FROM {table} WHERE user_email=%s',(email,))
        with db_connect() as connection, connection.cursor() as cursor:
            for table in ('user_custom_layers','user_custom_folders'):
                cursor.execute(f'SELECT COUNT(*) FROM {table} WHERE user_email=%s',(email,))
                assert cursor.fetchone()[0] == 0, table
        print('PASS: fixture layers and folders remaining: 0', flush=True)


if __name__ == '__main__':
    main()
