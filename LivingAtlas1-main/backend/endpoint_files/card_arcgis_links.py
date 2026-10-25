import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_request_connection, release_request_connection

card_arcgis_links_router = APIRouter()


def _database():
    connection = get_request_connection()
    if connection is None:
        raise HTTPException(503, 'Linked layers are temporarily unavailable. Please try again.')
    try:
        with connection.cursor() as cursor:
            yield connection, cursor
    except HTTPException:
        raise
    except Exception:
        logging.getLogger(__name__).exception('Card-linked layer request failed')
        raise HTTPException(500, 'Could not update linked layers. Please try again.')
    finally:
        release_request_connection(connection)


def _require_editor(cursor, card_id, email):
    # Use the existing application account-email identity convention.
    cursor.execute('''
        SELECT owner.Email, COALESCE(viewer.Is_Admin, FALSE)
        FROM Cards card JOIN Users owner ON owner.UserID=card.UserID
        LEFT JOIN Users viewer ON LOWER(viewer.Email)=LOWER(%s)
        WHERE card.CardID=%s
    ''', (email or '', card_id))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, 'Project not found')
    if not email or (row[0].lower() != email.lower() and not row[1]):
        raise HTTPException(403, 'Only the project creator or an admin can change published linked layers')
    return row[0]


def _require_link_editor(cursor, link_id, email):
    cursor.execute('SELECT card_id FROM CardArcGISLinks WHERE id=%s', (link_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, 'Linked layer not found')
    _require_editor(cursor, row[0], email)


class LinkCreate(BaseModel):
    card_id: int
    service_key: str
    layer_id: Optional[int] = None
    sublayer_index: Optional[int] = None
    display_name: str
    item_type: str
    state_code: str
    folder_name: str
    requester_email: Optional[str] = None


class LinkVisibilityUpdate(BaseModel):
    is_visible: bool
    requester_email: Optional[str] = None


class LinkVisibilityByServiceUpdate(LinkVisibilityUpdate):
    service_key: str


@card_arcgis_links_router.get('/cardArcGISLinks')
def get_card_arcgis_links(card_id: int, user_email: str = '', database=Depends(_database)):
    _, cursor = database
    cursor.execute('''
        SELECT l.id,l.card_id,l.service_key,l.layer_id,l.sublayer_index,
               l.display_name,l.item_type,l.state_code,l.folder_name,l.is_visible,
               CASE WHEN custom.id IS NOT NULL THEN 'shared-custom-' || custom.id::text END,
               (LOWER(owner.Email)=LOWER(%s) OR COALESCE(viewer.Is_Admin,FALSE)),
               COALESCE(LOWER(custom.user_email)=LOWER(%s),FALSE)
        FROM CardArcGISLinks l JOIN Cards card ON card.CardID=l.card_id
        JOIN Users owner ON owner.UserID=card.UserID
        LEFT JOIN Users viewer ON LOWER(viewer.Email)=LOWER(%s)
        LEFT JOIN user_custom_layers custom ON l.item_type='uploaded_custom' AND custom.id=l.custom_layer_id
        WHERE l.card_id=%s AND ((COALESCE(card.is_public,TRUE) AND l.is_visible)
            OR LOWER(owner.Email)=LOWER(%s) OR COALESCE(viewer.Is_Admin,FALSE))
        ORDER BY l.id
    ''', (user_email,user_email,user_email,card_id,user_email))
    columns = ['id','card_id','service_key','layer_id','sublayer_index','display_name',
               'item_type','state_code','folder_name','is_visible','shared_layer_key','can_manage','source_is_personal']
    return {'data':[dict(zip(columns,row)) for row in cursor.fetchall()]}


@card_arcgis_links_router.get('/cardArcGISLinks/by-service')
def get_card_arcgis_links_by_service(service_key: str, user_email: str = '', database=Depends(_database)):
    _, cursor = database
    cursor.execute('''
        SELECT l.id,l.card_id,card.Title,l.service_key,l.layer_id,l.sublayer_index,
               l.display_name,l.item_type,l.state_code,l.folder_name,l.is_visible
        FROM CardArcGISLinks l JOIN Cards card ON card.CardID=l.card_id
        JOIN Users owner ON owner.UserID=card.UserID
        WHERE l.service_key=%s AND ((COALESCE(card.is_public,TRUE) AND l.is_visible)
            OR LOWER(owner.Email)=LOWER(%s)) ORDER BY l.id
    ''', (service_key,user_email))
    columns = ['id','card_id','card_title','service_key','layer_id','sublayer_index',
               'display_name','item_type','state_code','folder_name','is_visible']
    return {'data':[dict(zip(columns,row)) for row in cursor.fetchall()]}


@card_arcgis_links_router.get('/cardArcGISLinks/public-custom-layer/{link_id}')
def get_public_custom_layer(link_id: int, database=Depends(_database)):
    _, cursor = database
    # Resolve the linked asset, independently of the viewer's personal library.
    cursor.execute('''
        SELECT custom.id,custom.label,custom.geojson
        FROM CardArcGISLinks l JOIN Cards card ON card.CardID=l.card_id
        JOIN Users owner ON owner.UserID=card.UserID
        JOIN user_custom_layers custom ON custom.id=l.custom_layer_id
        WHERE l.id=%s AND l.item_type='uploaded_custom' AND l.is_visible AND COALESCE(card.is_public,TRUE)
    ''', (link_id,))
    row = cursor.fetchone()
    if row is None or not row[2]:
        raise HTTPException(404, 'This shared layer is unavailable or is no longer public')
    return {'service':{'key':f'shared-custom-{row[0]}','label':row[1],'type':'uploaded'},
            'geojson':json.loads(row[2]) if isinstance(row[2],str) else row[2]}


@card_arcgis_links_router.get('/cardArcGISLinks/visible-custom-layers')
def get_visible_custom_layer_service_keys(user_email: str = '', database=Depends(_database)):
    _, cursor = database
    cursor.execute('''
        SELECT DISTINCT l.service_key FROM CardArcGISLinks l
        JOIN Cards card ON card.CardID=l.card_id JOIN Users owner ON owner.UserID=card.UserID
        WHERE l.item_type='uploaded_custom' AND l.is_visible AND LOWER(owner.Email)=LOWER(%s)
    ''', (user_email,))
    return {'service_keys':[row[0] for row in cursor.fetchall()]}


@card_arcgis_links_router.get('/cardArcGISLinks/visible-arcgis-layers')
def get_visible_arcgis_layer_targets(user_email: str = '', database=Depends(_database)):
    _, cursor = database
    cursor.execute('''
        SELECT DISTINCT l.service_key,l.layer_id FROM CardArcGISLinks l
        JOIN Cards card ON card.CardID=l.card_id JOIN Users owner ON owner.UserID=card.UserID
        WHERE l.item_type!='uploaded_custom' AND l.is_visible
            AND (COALESCE(card.is_public,TRUE) OR LOWER(owner.Email)=LOWER(%s))
    ''', (user_email,))
    return {'items':[{'service_key':row[0],'layer_id':row[1]} for row in cursor.fetchall()]}


@card_arcgis_links_router.post('/cardArcGISLinks')
def create_card_arcgis_link(link: LinkCreate, database=Depends(_database)):
    connection,cursor = database
    owner = _require_editor(cursor,link.card_id,link.requester_email)
    custom_layer_id = None
    if link.item_type == 'uploaded_custom':
        cursor.execute('''SELECT id FROM user_custom_layers WHERE service_key=%s AND user_email IN (%s,%s)
            ORDER BY (LOWER(user_email)=LOWER(%s)) DESC LIMIT 1''', (link.service_key,link.requester_email,owner,link.requester_email))
        asset = cursor.fetchone()
        if asset is None:
            raise HTTPException(404, 'The custom layer is unavailable in the source library')
        custom_layer_id = asset[0]
    cursor.execute('''
        INSERT INTO CardArcGISLinks (card_id,service_key,layer_id,sublayer_index,display_name,item_type,state_code,folder_name,custom_layer_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
    ''', (link.card_id,link.service_key,link.layer_id,link.sublayer_index,link.display_name,link.item_type,link.state_code,link.folder_name,custom_layer_id))
    result = cursor.fetchone()[0]
    connection.commit()
    return {'id':result}


@card_arcgis_links_router.patch('/cardArcGISLinks/by-service')
def update_card_arcgis_links_visibility_by_service(update: LinkVisibilityByServiceUpdate, database=Depends(_database)):
    connection,cursor = database
    if not update.requester_email:
        raise HTTPException(403, 'Sign in to change your published linked layers')
    # A personal library toggle must not alter another creator's published links.
    cursor.execute('''
        UPDATE CardArcGISLinks l SET is_visible=%s FROM Cards card, Users owner
        WHERE l.card_id=card.CardID AND card.UserID=owner.UserID
            AND LOWER(owner.Email)=LOWER(%s) AND l.service_key=%s AND l.item_type='uploaded_custom'
    ''', (update.is_visible,update.requester_email,update.service_key))
    connection.commit()
    return {'success':True}


@card_arcgis_links_router.patch('/cardArcGISLinks/{link_id}')
def update_card_arcgis_link_visibility(link_id: int, update: LinkVisibilityUpdate, database=Depends(_database)):
    connection,cursor = database
    _require_link_editor(cursor,link_id,update.requester_email)
    cursor.execute('UPDATE CardArcGISLinks SET is_visible=%s WHERE id=%s',(update.is_visible,link_id))
    connection.commit()
    return {'success':True}


@card_arcgis_links_router.delete('/cardArcGISLinks/{link_id}')
def delete_card_arcgis_link(link_id: int, requester_email: str = '', database=Depends(_database)):
    connection,cursor = database
    _require_link_editor(cursor,link_id,requester_email)
    cursor.execute('DELETE FROM CardArcGISLinks WHERE id=%s',(link_id,))
    connection.commit()
    return {'success':True}
