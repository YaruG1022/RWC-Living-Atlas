import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
from fastapi import FastAPI


class CardLinkSharingTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = types.ModuleType('database')
        cls.db.get_request_connection = MagicMock()
        cls.db.release_request_connection = MagicMock()
        path = Path(__file__).resolve().parents[1]/'endpoint_files'/'card_arcgis_links.py'
        spec = importlib.util.spec_from_file_location('card_link_sharing_test',path)
        cls.routes = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules,{'database':cls.db}):
            spec.loader.exec_module(cls.routes)
        cls.app = FastAPI()
        cls.app.include_router(cls.routes.card_arcgis_links_router)

    async def asyncSetUp(self):
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value
        self.db.get_request_connection.return_value = self.connection
        self.db.release_request_connection.reset_mock()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app),base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()
        self.assertFalse(any('CREATE ' in c.args[0] or 'ALTER ' in c.args[0] for c in self.cursor.execute.call_args_list))

    async def test_public_custom_layer_resolves_creator_asset_without_viewer_credentials(self):
        self.cursor.fetchone.return_value = (42,'Shared layer',json.dumps({'type':'FeatureCollection','features':[]}))
        response = await self.client.get('/cardArcGISLinks/public-custom-layer/7')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['service']['key'],'shared-custom-42')
        sql = self.cursor.execute.call_args.args[0]
        self.assertIn('custom.id=l.custom_layer_id',sql)
        self.assertIn('l.is_visible',sql)
        self.assertIn('card.is_public',sql)
        self.db.release_request_connection.assert_called_once_with(self.connection)

    async def test_private_hidden_or_removed_shared_asset_returns_404(self):
        for row in [None,(42,'Missing data',None)]:
            self.cursor.fetchone.return_value = row
            response = await self.client.get('/cardArcGISLinks/public-custom-layer/7')
            self.assertEqual(response.status_code,404)

    async def test_arcgis_restore_filters_public_or_current_owner(self):
        self.cursor.fetchall.return_value = [('wa-rivers',3)]
        response = await self.client.get('/cardArcGISLinks/visible-arcgis-layers',params={'user_email':'viewer@example.invalid'})
        self.assertEqual(response.json(),{'items':[{'service_key':'wa-rivers','layer_id':3}]})
        sql,params = self.cursor.execute.call_args.args
        self.assertIn('card.is_public',sql)
        self.assertEqual(params,('viewer@example.invalid',))

    async def test_personal_custom_restore_is_scoped_to_the_creator(self):
        self.cursor.fetchall.return_value = [('uploaded-1',)]
        response = await self.client.get('/cardArcGISLinks/visible-custom-layers',params={'user_email':'owner@example.invalid'})
        self.assertEqual(response.json()['service_keys'],['uploaded-1'])
        self.assertIn('LOWER(owner.Email)=LOWER(%s)',self.cursor.execute.call_args.args[0])

    async def test_other_viewer_cannot_change_published_visibility(self):
        self.cursor.fetchone.side_effect = [(101,),('owner@example.invalid',False)]
        response = await self.client.patch('/cardArcGISLinks/7',json={'is_visible':False,'requester_email':'viewer@example.invalid'})
        self.assertEqual(response.status_code,403)
        self.connection.commit.assert_not_called()

    async def test_creator_can_publish_visibility(self):
        self.cursor.fetchone.side_effect = [(101,),('owner@example.invalid',False)]
        response = await self.client.patch('/cardArcGISLinks/7',json={'is_visible':True,'requester_email':'owner@example.invalid'})
        self.assertEqual(response.status_code,200)
        self.connection.commit.assert_called_once()

    async def test_admin_link_retains_the_selected_source_asset_identity(self):
        self.cursor.fetchone.side_effect = [('owner@example.invalid',True),(42,),(99,)]
        response = await self.client.post('/cardArcGISLinks',json={
            'card_id':101,'service_key':'same-key','display_name':'Source asset','item_type':'uploaded_custom',
            'state_code':'','folder_name':'Root','requester_email':'admin@example.invalid',
        })
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.cursor.execute.call_args.args[1][-1],42)

    async def test_bulk_library_toggle_is_scoped_to_creator_and_custom_layers(self):
        response = await self.client.patch('/cardArcGISLinks/by-service',json={'service_key':'same-key','is_visible':False,'requester_email':'owner@example.invalid'})
        self.assertEqual(response.status_code,200)
        sql,params = self.cursor.execute.call_args.args
        self.assertIn('owner.Email',sql)
        self.assertIn("l.item_type='uploaded_custom'",sql)
        self.assertEqual(params,(False,'owner@example.invalid','same-key'))
