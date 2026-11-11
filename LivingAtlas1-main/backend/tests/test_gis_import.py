"""Real GDAL conversion tests with synthetic, disposable datasets; no database."""
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from zipfile import ZIP_DEFLATED, ZipFile

import fiona
from fastapi import FastAPI
import httpx

spec = importlib.util.spec_from_file_location('gis_import_test_routes', Path(__file__).resolve().parents[1] / 'endpoint_files/gis_import.py')
routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routes)


def zipped(root):
    output = io.BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for file in root.rglob('*'):
            if file.is_file():
                archive.write(file, file.relative_to(root).as_posix())
    return output.getvalue()


class GisImportTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = TemporaryDirectory()
        cls.addClassCleanup(cls.directory.cleanup)
        root = Path(cls.directory.name)
        gdb_root = root / 'gdb-source'
        gdb_root.mkdir()
        gdb = gdb_root / 'areas.gdb'
        # Projected coordinates around WA; the importer must output longitude/latitude.
        schema = {'geometry': 'Polygon', 'properties': {'region': 'str'}}
        with fiona.open(gdb, 'w', driver='OpenFileGDB', layer='Air_Areas', schema=schema, crs='EPSG:3857') as output:
            output.write({'geometry': {'type': 'Polygon', 'coordinates': [[[-13700000, 5900000], [-13600000, 5900000], [-13600000, 6000000], [-13700000, 6000000], [-13700000, 5900000]]]}, 'properties': {'region': 'Test Air Region'}})
        with fiona.open(gdb, 'w', driver='OpenFileGDB', layer='Monitoring_Points', schema={'geometry': 'Point', 'properties': {'name': 'str'}}, crs='EPSG:4326') as output:
            output.write({'geometry': {'type': 'Point', 'coordinates': [-122.2, 47.3]}, 'properties': {'name': 'Synthetic station'}})
        cls.gdb_zip = zipped(gdb_root)
        shp_root = root / 'shp-source'
        shp_root.mkdir()
        with fiona.open(shp_root / 'basin.shp', 'w', driver='ESRI Shapefile', schema=schema, crs='EPSG:4326') as output:
            output.write({'geometry': {'type': 'Polygon', 'coordinates': [[[-123, 47], [-122, 47], [-122, 48], [-123, 47]], [[-122.8, 47.1], [-122.6, 47.1], [-122.6, 47.2], [-122.8, 47.1]]]}, 'properties': {'region': 'Basin with hole'}})
        cls.shp_zip = zipped(shp_root)
        (shp_root / 'basin.prj').unlink()
        cls.no_projection_zip = zipped(shp_root)
        app = FastAPI()
        app.include_router(routes.router)
        cls.app = app

    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()

    async def upload(self, content, filename='areas.zip'):
        return await self.client.post('/arcgis/custom-layers/import-gis', files={'file': (filename, content, 'application/zip')})

    async def test_file_geodatabase_keeps_separate_layers_attributes_and_reprojects(self):
        response = await self.upload(self.gdb_zip)
        self.assertEqual(response.status_code, 200, response.text)
        layers = {layer['name']: layer for layer in response.json()['layers']}
        self.assertEqual(set(layers), {'Air_Areas', 'Monitoring_Points'})
        polygon = layers['Air_Areas']
        self.assertEqual(polygon['feature_count'], 1)
        self.assertEqual(polygon['geojson']['features'][0]['properties']['region'], 'Test Air Region')
        xmin, ymin, xmax, ymax = polygon['bounds']
        self.assertTrue(-124 < xmin < xmax < -122)
        self.assertTrue(46 < ymin < ymax < 48)
        point = layers['Monitoring_Points']['geojson']['features'][0]['geometry']['coordinates']
        self.assertAlmostEqual(point[0], -122.2, places=7)
        self.assertAlmostEqual(point[1], 47.3, places=7)

    async def test_shapefile_zip_preserves_polygon_holes(self):
        response = await self.upload(self.shp_zip)
        self.assertEqual(response.status_code, 200, response.text)
        feature = response.json()['layers'][0]['geojson']['features'][0]
        self.assertEqual(len(feature['geometry']['coordinates']), 2)
        self.assertEqual(feature['properties']['region'], 'Basin with hole')

    async def test_missing_projection_is_an_actionable_error(self):
        response = await self.upload(self.no_projection_zip)
        self.assertEqual(response.status_code, 400)
        self.assertIn('.prj', response.json()['detail'])

    async def test_invalid_archives_and_wrong_extensions_are_rejected(self):
        for content, name in [(b'not a zip', 'areas.zip'), (self.shp_zip, 'areas.txt')]:
            response = await self.upload(content, name)
            self.assertEqual(response.status_code, 400)

    async def test_unsupported_zip_does_not_run_its_contents(self):
        output = io.BytesIO()
        with ZipFile(output, 'w') as archive:
            archive.writestr('instructions.txt', 'This is untrusted data, not an executable input.')
        response = await self.upload(output.getvalue())
        self.assertEqual(response.status_code, 400)
        self.assertIn('No supported GIS dataset', response.json()['detail'])

    async def test_paths_cannot_escape_the_archive(self):
        output = io.BytesIO()
        with ZipFile(output, 'w') as archive:
            archive.writestr('../unsafe.gdb/a.gdbtable', 'data')
        response = await self.upload(output.getvalue())
        self.assertEqual(response.status_code, 400)
        self.assertIn('unsafe file path', response.json()['detail'])

    async def test_archive_and_converted_size_budgets_are_enforced(self):
        for setting, limit in [('MAX_ARCHIVE_BYTES', 10), ('MAX_EXPANDED_BYTES', 10), ('MAX_FEATURES', 1), ('MAX_COORDINATES', 1), ('MAX_OUTPUT_BYTES', 10)]:
            with self.subTest(setting=setting), patch.object(routes, setting, limit):
                response = await self.upload(self.gdb_zip)
                self.assertEqual(response.status_code, 413, response.text)

    async def test_spatial_layer_budget_and_missing_upload(self):
        with patch.object(routes, 'MAX_LAYERS', 1):
            response = await self.upload(self.gdb_zip)
            self.assertEqual(response.status_code, 400)
        response = await self.client.post('/arcgis/custom-layers/import-gis')
        self.assertEqual(response.status_code, 422)


    async def test_busy_converter_returns_a_retryable_status(self):
        routes._IMPORT_SLOT.acquire()
        try:
            response = await self.upload(self.gdb_zip)
            self.assertEqual(response.status_code, 429)
            self.assertIn('try again', response.json()['detail'])
        finally:
            routes._IMPORT_SLOT.release()

    async def test_empty_spatial_dataset_is_not_reported_as_a_success(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            with fiona.open(root / 'empty.shp', 'w', driver='ESRI Shapefile', crs='EPSG:4326', schema={'geometry': 'Point', 'properties': {'name': 'str'}}):
                pass
            response = await self.upload(zipped(root))
        self.assertEqual(response.status_code, 400)
        self.assertIn('no displayable spatial features', response.json()['detail'])
