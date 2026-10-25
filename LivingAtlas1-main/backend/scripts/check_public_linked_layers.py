"""Per-user card layer visibility: account isolation, shared assets and private exclusions.

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
                CREATE TABLE CardArcGISLinks (id INTEGER PRIMARY KEY,card_id INTEGER,service_key TEXT,item_type TEXT,is_visible BOOLEAN NOT NULL DEFAULT FALSE);
                INSERT INTO Users VALUES (1,'owner-a'),(2,'owner-b'),(3,'owner-c');
                INSERT INTO Cards VALUES (1,1),(2,3);
                INSERT INTO user_custom_layers VALUES (11,'owner-a','own'),(22,'owner-b','unique'),(31,'owner-a','duplicate'),(32,'owner-b','duplicate');
                INSERT INTO CardArcGISLinks (id,card_id,service_key,item_type) VALUES (1,1,'own','uploaded_custom'),(2,2,'unique','uploaded_custom'),
                    (3,1,'duplicate','uploaded_custom'),(4,2,'duplicate','uploaded_custom');
            """)
            cursor.execute('UPDATE CardArcGISLinks SET is_visible=TRUE WHERE id=1')
            ensure_card_link_schema(cursor)
            cursor.execute('SELECT link_id,user_id,is_visible FROM card_link_visibility')
            assert cursor.fetchall()==[(1,1,True)]
            cursor.execute('UPDATE card_link_visibility SET is_visible=FALSE WHERE link_id=1')
            ensure_card_link_schema(cursor)
            cursor.execute('SELECT link_id,user_id,is_visible FROM card_link_visibility')
            assert cursor.fetchall()==[(1,1,False)]
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
    print('PASS: legacy display migrates only to creator, hidden preference survives restart; exact asset migration remains repeatable',flush=True)


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

        all_ids={arc_on,custom_a,arc_off,custom_off}
        def states(card,viewer):
            return {row['id']:row['is_visible'] for row in links(card,viewer)}
        alice_initial={arc_on:True,custom_a:True,arc_off:False,custom_off:False}
        assert states(public_a,alice)==alice_initial
        assert states(public_a,bob)==dict.fromkeys(all_ids,False)
        assert states(public_a,'')==dict.fromkeys(all_ids,False)
        # Anyone who can see a public card can choose any linked layer, even
        # when its creator has it hidden. Asset sharing does not depend on preferences.
        for layer in [arc_on,custom_a,arc_off,custom_off]:
            request('PATCH',f'/cardArcGISLinks/{layer}',json={'requester_email':bob,'is_visible':True})
        assert states(public_a,bob)==dict.fromkeys(all_ids,True)
        assert states(public_a,alice)==alice_initial
        assert states(public_a,'')==dict.fromkeys(all_ids,False)
        for layer in [arc_on,custom_a]:
            request('PATCH',f'/cardArcGISLinks/{layer}',json={'requester_email':alice,'is_visible':False})
        assert states(public_a,alice)==dict.fromkeys(all_ids,False)
        assert states(public_a,bob)==dict.fromkeys(all_ids,True)
        # Repeated fresh HTTP reads model reopen/reload, not shared in-memory state.
        assert states(public_a,bob)==dict.fromkeys(all_ids,True)
        a=request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_a}')
        b=request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_b}')
        assert a['geojson']['features'][0]['properties']['fixture']==1
        assert b['geojson']['features'][0]['properties']['fixture']==2
        assert a['service']['key']!=b['service']['key']
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_off}')
        assert links(private_a,bob)==[] and links(private_a)==[]
        request('GET',f'/cardArcGISLinks/public-custom-layer/{private_custom}',404)
        own_private=request('GET',f'/cardArcGISLinks/public-custom-layer/{private_custom}',params={'user_email':alice})
        assert own_private['geojson']['features'][0]['properties']['fixture']==3
        request('PATCH',f'/cardArcGISLinks/{private_custom}',404,json={'requester_email':bob,'is_visible':True})
        request('PATCH',f'/cardArcGISLinks/{custom_a}',403,json={'is_visible':True})
        print('PASS: two accounts keep opposite ArcGIS/custom choices; reload and guest isolation; public asset independent of creator visibility',flush=True)

        assert request('GET','/cardArcGISLinks/visible-arcgis-layers')['items']==[]
        bob_targets=request('GET','/cardArcGISLinks/visible-arcgis-layers',params={'user_email':bob})['items']
        assert {row['service_key'] for row in bob_targets if row['service_key'].startswith(prefix)}=={prefix+'_public_arc',prefix+'_off_arc'}
        alice_targets=request('GET','/cardArcGISLinks/visible-arcgis-layers',params={'user_email':alice})['items']
        assert {row['service_key'] for row in alice_targets if row['service_key'].startswith(prefix)}=={prefix+'_private_arc'}
        # Legacy clients still write only the requesting viewer's preference rows.
        request('PATCH','/cardArcGISLinks/by-service',json={'requester_email':bob,'service_key':shared,'is_visible':False})
        assert states(public_a,bob)[custom_a] is False
        assert states(public_b,bob)[custom_b] is False
        assert states(public_b,alice)[custom_b] is False
        assert states(public_b,'')[custom_b] is False
        request('PATCH',f'/cardArcGISLinks/{custom_a}',json={'requester_email':alice,'is_visible':True})
        assert states(public_a,bob)[custom_a] is False
        assert states(public_a,alice)[custom_a] is True
        # Another card linked to the very same asset has a separate preference.
        duplicate=link(public_a,alice,shared,'uploaded_custom',False)
        assert states(public_a,alice)[duplicate] is False
        assert states(public_a,alice)[custom_a] is True
        request('DELETE',f'/cardArcGISLinks/{duplicate}',params={'requester_email':alice})
        # Concurrent requests for different accounts may never overwrite each other.
        def set_and_read(viewer,visible):
            request('PATCH',f'/cardArcGISLinks/{custom_a}',json={'requester_email':viewer,'is_visible':visible})
            assert states(public_a,viewer)[custom_a] is visible
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs=[pool.submit(set_and_read,alice,True),pool.submit(set_and_read,bob,False)]
            for job in jobs: job.result()
        assert query('SELECT COUNT(*) FROM CardArcGISLinks WHERE card_id=ANY(%s) AND is_visible',([public_a,public_b,private_a],))[0][0]==0
        print('PASS: account-scoped map restore, legacy bulk requests, per-link choices, simultaneous accounts and unchanged legacy shared flags',flush=True)

        query('UPDATE Users SET Is_Admin=TRUE WHERE Email=%s',(bob,))
        cross=link(public_a,bob,shared,'uploaded_custom')
        cross_data=request('GET',f'/cardArcGISLinks/public-custom-layer/{cross}')
        assert cross_data['geojson']['features'][0]['properties']['fixture']==2
        assert states(public_a,alice)[cross] is False
        assert states(public_a,bob)[cross] is True
        request('DELETE',f'/cardArcGISLinks/{cross}',params={'requester_email':bob})
        assert query('SELECT COUNT(*) FROM card_link_visibility WHERE link_id=%s',(cross,))[0][0]==0
        query('UPDATE Users SET Is_Admin=FALSE WHERE Email=%s',(bob,))
        query('UPDATE Cards SET is_public=FALSE WHERE CardID=%s',(public_a,))
        assert links(public_a,bob)==[]
        request('GET',f'/cardArcGISLinks/public-custom-layer/{custom_a}',404,params={'user_email':bob})
        request('PATCH',f'/cardArcGISLinks/{custom_a}',404,json={'requester_email':bob,'is_visible':True})
        assert states(public_a,alice)[custom_a] is True
        bob_targets=request('GET','/cardArcGISLinks/visible-arcgis-layers',params={'user_email':bob})['items']
        assert not any(row['service_key'].startswith(prefix) for row in bob_targets)
        print('PASS: admin choices also personal; deleted links cascade preferences; public-to-private access revocation',flush=True)
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
        assert query('SELECT COUNT(*) FROM card_link_visibility preference JOIN Users viewer ON viewer.UserID=preference.user_id WHERE viewer.Email=ANY(%s)',([alice,bob],))[0][0]==0
        assert query('SELECT COUNT(*) FROM Users WHERE Email=ANY(%s)',([alice,bob],))[0][0]==0
        assert query('SELECT COUNT(*) FROM user_custom_layers WHERE user_email=ANY(%s)',([alice,bob],))[0][0]==0
        connection.close()
        print('PASS: fixture cards, accounts, links and personal-layer rows cleaned',flush=True)


if __name__=='__main__':
    main()
