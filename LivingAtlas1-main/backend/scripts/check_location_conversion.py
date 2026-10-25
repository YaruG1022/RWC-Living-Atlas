"""Verify location-type changes against an isolated local backend and database."""
import importlib.util
import io
import json
import sys
import uuid
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from load_tests.common import require_local_target, db_connect, timed_request


def main():
    require_local_target()
    name = 'location_conversion_' + uuid.uuid4().hex
    email = name + '@example.invalid'
    card_id = None
    assets = set()
    fields = dict(username=name, email=email, title=name, name='Location fixture',
                  category='River', latitude='46', longitude='-117', defer_images='true')
    vertices = [{'lat':46,'lng':-117},{'lat':47,'lng':-117},{'lat':47,'lng':-116},{'lat':46,'lng':-116}]
    raw = io.BytesIO()
    Image.new('RGB',(32,32),'green').save(raw,format='PNG')

    def request(method, path, **kwargs):
        result = timed_request(method,path,**kwargs)
        assert result['status'] == 200 and result['ok'], result
        return result['body']

    try:
        with db_connect() as connection, connection.cursor() as cursor:
            cursor.execute('SELECT CategoryID FROM Categories')
            existing_categories = {row[0] for row in cursor.fetchall()}
            category = next((label for value, label in [(5,'Other'),(4,'None'),(1,'River'),(2,'Watershed'),(3,'Places')]
                             if value in existing_categories), None)
            assert category, 'The isolated database needs at least one supported category'
            fields['category'] = category
            cursor.execute('LOCK TABLE Users IN SHARE ROW EXCLUSIVE MODE')
            cursor.execute('SELECT COALESCE(MAX(UserID),0)+1 FROM Users')
            user_id = cursor.fetchone()[0]
            cursor.execute('INSERT INTO Users (UserID,Username,Email,HashedPassword,Salt) VALUES (%s,%s,%s,%s,%s)',
                           (user_id,name,email,'fixture',b'fixture'))
        card_id = request('POST','/uploadForm',data=fields)['card_id']
        source = 'point'
        # Covers every directed pair of point/polygon/image, retaining one CardID.
        for target in ['polygon','image','point','image','polygon','point','multipoint']:
            data = {**fields,'update':'true','original_username':name,'original_email':email,'original_title':name,'requester_email':email,'location_type':target}
            if target == 'polygon': data['polygon_coordinates'] = json.dumps({'rings':[vertices],'ringStyles':[{'fillColor':'#123456','lineStyle':'dashed'}]})
            if target == 'image': data['polygon_coordinates'] = json.dumps({'vertices':vertices})
            if target == 'multipoint': data['multipoint_coordinates'] = json.dumps(vertices[:2])
            files = {'thumbnail':('overlay.png',raw.getvalue(),'image/png')} if target == 'image' else {}
            response = request('POST','/uploadForm',data=data,files=files)
            assert response['card_id'] == card_id
            for path in ['/allCards','/getMarkers']:
                records = request('GET',path)
                records = records['data'] if isinstance(records,dict) else records
                record = next(row for row in records if row['cardID'] == card_id)
                assert record['location_type'] == target, record
                expected = 0 if target == 'point' else 2 if target == 'multipoint' else 4
                assert len(record['polygon_vertices']) == expected, record
                if target == 'image':
                    assert record['thumbnail_link'].startswith('/uploads/local_test/')
                    assets.add(record['thumbnail_link'])
            with db_connect() as connection, connection.cursor() as cursor:
                cursor.execute('SELECT LocationType FROM Cards WHERE CardID=%s',(card_id,))
                assert cursor.fetchone()[0] == target
                cursor.execute('SELECT COUNT(*) FROM CardPolygonVertices WHERE CardID=%s',(card_id,))
                assert cursor.fetchone()[0] == expected
            print(f'PASS: {source} -> {target}; stable CardID, persisted geometry and both listing APIs agree',flush=True)
            source = target
    finally:
        with db_connect() as connection, connection.cursor() as cursor:
            if card_id is None:
                cursor.execute('SELECT CardID FROM Cards WHERE Title=%s AND UserID=%s',(name,locals().get('user_id',-1)))
                row = cursor.fetchone()
                card_id = row[0] if row else None
            if card_id is not None:
                cursor.execute('SELECT Thumbnail_Link FROM Cards WHERE CardID=%s',(card_id,))
                row = cursor.fetchone()
                if row and row[0] and row[0].startswith('/uploads/local_test/'): assets.add(row[0])
                cursor.execute('SELECT ImageURL,OriginalURL FROM CardImages WHERE CardID=%s',(card_id,))
                for urls in cursor.fetchall(): assets.update(url for url in urls if url)
                for table in ['CardImages','CardPolygonVertices','CardTags','Files']:
                    cursor.execute(f'DELETE FROM {table} WHERE CardID=%s',(card_id,))
                cursor.execute('DELETE FROM Cards WHERE CardID=%s AND Title=%s',(card_id,name))
            cursor.execute('DELETE FROM Users WHERE Username=%s AND Email=%s',(name,email))
        spec = importlib.util.spec_from_file_location('local_conversion_storage',Path(__file__).resolve().parents[1]/'endpoint_files'/'azure_storage.py')
        storage = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(storage)
        for url in assets:
            assert url.startswith('/uploads/local_test/'), url
            storage.delete_from_url(url)
            assert timed_request('GET',url)['status'] == 404, 'Fixture asset still served'
        with db_connect() as connection, connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM Users WHERE Username=%s',(name,))
            assert cursor.fetchone()[0] == 0
            cursor.execute('SELECT COUNT(*) FROM Cards WHERE Title=%s',(name,))
            assert cursor.fetchone()[0] == 0
        print(f'PASS: fixture account/card/geometry cleaned; {len(assets)} fixture assets removed',flush=True)


if __name__ == '__main__':
    main()
