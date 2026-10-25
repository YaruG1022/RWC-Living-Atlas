"""Public-card layer sharing: two accounts, anonymous reads, private/off exclusions.

Only runs against the isolated local test database; cleans its unique fixtures.
"""
import json
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from load_tests.common import require_local_target,db_connect,timed_request
from card_link_schema import ensure_card_link_schema


def check_legacy_sources():
    schema='layer_link_legacy_'+uuid.uuid4().hex
    connection=db_connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE SCHEMA {schema}')
            cursor.execute(f'SET LOCAL search_path TO {schema}')
            cursor.execute("""
                CREATE TABLE Users (UserID INTEGER PRIMARY KEY,Email TEXT);
                CREATE TABLE Cards (CardID INTEGER PRIMARY KEY,UserID INTEGER);
                CREATE TABLE user_custom_layers (id INTEGER PRIMARY KEY,user_email TEXT,service_key TEXT);
                CREATE TABLE CardArcGISLinks (id INTEGER PRIMARY KEY,card_id INTEGER,service_key TEXT,item_type TEXT);
                INSERT INTO Users VALUES (1,'owner-a'),(2,'owner-b'),(3,'owner-c');
                INSERT INTO Cards VALUES (1,1),(2,3);
                INSERT INTO user_custom_layers VALUES (11,'owner-a','own'),(22,'owner-b','unique'),(31,'owner-a','duplicate'),(32,'owner-b','duplicate');
                INSERT INTO CardArcGISLinks VALUES (1,1,'own','uploaded_custom'),(2,2,'unique','uploaded_custom'),
                    (3,1,'duplicate','uploaded_custom'),(4,2,'duplicate','uploaded_custom');
            """)
            ensure_card_link_schema(cursor)
            ensure_card_link_schema(cursor)
            cursor.execute('SELECT id,custom_layer_id FROM CardArcGISLinks ORDER BY id')
            assert cursor.fetchall()==[(1,11),(2,22),(3,31),(4,None)]
            cursor.execute('DELETE FROM user_custom_layers WHERE id=11')
            cursor.execute("INSERT INTO user_custom_layers VALUES (99,'owner-a','own')")
            ensure_card_link_schema(cursor)
            cursor.execute('SELECT custom_layer_id FROM CardArcGISLinks WHERE id=1')
            assert cursor.fetchone()[0] is None
    finally:
        connection.rollback()
        connection.close()
    print('PASS: repeatable legacy migration resolves owned/unique sources and preserves ambiguous links without guessing',flush=True)


def main():
    require_local_target()
    check_legacy_sources()
    prefix='layer_share_'+uuid.uuid4().hex
    alice,bob=prefix+'_a@example.invalid',prefix+'_b@example.invalid'
    shared,private=prefix+'_same_key',prefix+'_private'
    connection=db_connect()
    calls=[]

    def request(method,path,expected=200,**kwargs):
        result=timed_request(method,path,**kwargs)
        assert result['status']==expected,result
        calls.append(result['status'])
        return result['body']

    def query(statement,params=()):
        with connection,connection.cursor() as cursor:
            cursor.execute(statement,params)
            return cursor.fetchall() if cursor.description else None

    def link(card,owner,key,kind,visible=True,layer=1):
        data=dict(card_id=card,requester_email=owner,service_key=key,layer_id=layer if kind!='uploaded_custom' else None,
                  display_name=key,item_type=kind,state_code='WA',folder_name='Root')
        result=request('POST','/cardArcGISLinks',json=data)['id']
        if visible: request('PATCH',f'/cardArcGISLinks/{result}',json={'requester_email':owner,'is_visible':True})
        return result

    def links(card,email=''):
        return request('GET','/cardArcGISLinks',params={'card_id':card,'user_email':email})['data']

    try:
        with connection,connection.cursor() as cursor:
            cursor.execute('LOCK TABLE Users, Cards IN SHARE ROW EXCLUSIVE MODE')
            cursor.execute('SELECT COALESCE(MAX(UserID),0)+1 FROM Users'); uid=cursor.fetchone()[0]
            for offset,email in enumerate([alice,bob]):
                cursor.execute('INSERT INTO Users (UserID,Username,Email,HashedPassword,Salt) VALUES (%s,%s,%s,%s,%s)',
                               (uid+offset,prefix+str(offset),email,'fixture',b'fixture'))
            cursor.execute('SELECT CategoryID FROM Categories ORDER BY CategoryID LIMIT 1');category=cursor.fetchone()[0]
            cursor.execute('SELECT COALESCE(MAX(CardID),0)+1 FROM Cards'); first=cursor.fetchone()[0]
            for index,owner,public in [(0,uid,True),(1,uid+1,True),(2,uid,False)]:
                cursor.execute('''INSERT INTO Cards (CardID,UserID,Title,Latitude,Longitude,CategoryID,Description,Name,is_public,ContactEmail)
                    VALUES (%s,%s,%s,46,-117,%s,'','Sharing fixture',%s,%s)''',
                    (first+index,owner,prefix+str(index),category,public,bob))
        public_a,public_b,private_a=first,first+1,first+2
        for owner,key,number in [(alice,shared,1),(bob,shared,2),(alice,private,3)]:
            geometry={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'fixture':number},'geometry':{'type':'Point','coordinates':[number,number]}}]}
            request('POST','/arcgis/custom-layers/save',json=dict(user_email=owner,service_key=key,label=f'Fixture {number}',url='uploaded://fixture',type='uploaded',geojson=json.dumps(geometry)))
        arc_on=link(public_a,alice,prefix+'_public_arc','layer')
        custom_a=link(public_a,alice,shared,'uploaded_custom')
        arc_off=link(public_a,alice,prefix+'_off_arc','layer',False)
        custom_off=link(public_a,alice,private,'uploaded_custom',False)
        custom_b=link(public_b,bob,shared,'uploaded_custom')
        private_arc=link(private_a,alice,prefix+'_private_arc','layer')
        private_custom=link(private_a,alice,private,'uploaded_custom')

        assert {r['id'] for r in links(public_a,alice)}=={arc_on,custom_a,arc_off,custom_off}
        for viewer in ['',bob]:
            visible=links(public_a,viewer)
            assert {r['id'] for r in visible}=={arc_on,custom_a}
            assert not any(r['can_manage'] for r in visible)
            assert links(private_a,viewer)==[]
        assert len(links(private_a,alice))==2
        a=request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_a}')
        b=request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_b}')
        assert a['service']['key']!=b['service']['key']
        assert a['geojson']['features'][0]['properties']['fixture']==1
        assert b['geojson']['features'][0]['properties']['fixture']==2
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_off}',404)
        request('GET',f'/cardArcGISLinks/public-custom-layer/{private_custom}',404)
        public_targets=request('GET','/cardArcGISLinks/visible-arcgis-layers')['items']
        assert any(r['service_key']==prefix+'_public_arc' for r in public_targets)
        assert not any(r['service_key'] in [prefix+'_private_arc',prefix+'_off_arc'] for r in public_targets)
        own_targets=request('GET','/cardArcGISLinks/visible-arcgis-layers',params={'user_email':alice})['items']
        assert any(r['service_key']==prefix+'_private_arc' for r in own_targets)
        assert request('GET','/cardArcGISLinks/visible-custom-layers')['service_keys']==[]
        print('PASS: creator, other account and anonymous visibility; private/off exclusions; owner data and colliding keys',flush=True)

        for viewer in ['',bob]:
            request('PATCH',f'/cardArcGISLinks/{custom_a}',403,json={'requester_email':viewer,'is_visible':False})
        request('PATCH','/cardArcGISLinks/by-service',json={'requester_email':bob,'service_key':shared,'is_visible':False})
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_a}')
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_b}',404)
        request('PATCH',f'/cardArcGISLinks/{custom_b}',json={'requester_email':bob,'is_visible':True})
        request('PATCH',f'/cardArcGISLinks/{custom_a}',json={'requester_email':alice,'is_visible':False})
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_a}',404)
        request('PATCH',f'/cardArcGISLinks/{custom_a}',json={'requester_email':alice,'is_visible':True})
        # An administrator can link their own upload to another creator's card;
        # the exact asset must survive even when both libraries use the same key.
        query('UPDATE Users SET Is_Admin=TRUE WHERE Email=%s',(bob,))
        cross=link(public_a,bob,shared,'uploaded_custom')
        cross_data=request('GET',f'/cardArcGISLinks/public-custom-layer/{cross}')
        assert cross_data['geojson']['features'][0]['properties']['fixture']==2
        cross_meta=next(row for row in links(public_a,alice) if row['id']==cross)
        assert cross_meta['source_is_personal'] is False
        request('DELETE',f'/cardArcGISLinks/{cross}',params={'requester_email':bob})
        query('UPDATE Users SET Is_Admin=FALSE WHERE Email=%s',(bob,))
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda _:request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_b}'),range(8)))
        query('UPDATE Cards SET is_public=FALSE WHERE CardID=%s',(public_a,))
        assert links(public_a,bob)==[]
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_a}',404)
        assert len(links(public_a,alice))==4
        targets=request('GET','/cardArcGISLinks/visible-arcgis-layers')['items']
        assert not any(r['service_key']==prefix+'_public_arc' for r in targets)
        print('PASS: creator-only publication, scoped bulk toggles, concurrent reads and public-to-private revocation',flush=True)
        print(json.dumps({'requests':len(calls),'expected_statuses':{str(status):calls.count(status) for status in set(calls)}}),flush=True)
    finally:
        connection.rollback()
        with connection,connection.cursor() as cursor:
            cursor.execute('SELECT CardID FROM Cards WHERE Title LIKE %s',(prefix+'%',))
            ids=[row[0] for row in cursor.fetchall()]
            for table in ['CardArcGISLinks','CardImages','CardPolygonVertices','CardTags','Files']:
                if ids:
                    column='card_id' if table=='CardArcGISLinks' else 'CardID'
                    cursor.execute(f'DELETE FROM {table} WHERE {column}=ANY(%s)',(ids,))
            cursor.execute('DELETE FROM Cards WHERE Title LIKE %s',(prefix+'%',))
            for table in ['user_custom_layers','user_custom_folders']:
                cursor.execute(f'DELETE FROM {table} WHERE user_email=ANY(%s)',([alice,bob],))
            cursor.execute('DELETE FROM Users WHERE Email=ANY(%s)',([alice,bob],))
        assert query('SELECT COUNT(*) FROM Cards WHERE Title LIKE %s',(prefix+'%',))[0][0]==0
        assert query('SELECT COUNT(*) FROM Users WHERE Email=ANY(%s)',([alice,bob],))[0][0]==0
        assert query('SELECT COUNT(*) FROM user_custom_layers WHERE user_email=ANY(%s)',([alice,bob],))[0][0]==0
        connection.close()
        print('PASS: fixture cards, accounts, links and personal-layer rows cleaned',flush=True)


if __name__=='__main__':
    main()
