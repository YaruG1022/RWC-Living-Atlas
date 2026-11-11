"""Explicitly refresh the two official boundary snapshots (requires GDAL/GEOS).

Run from the client directory: python scripts/builtin-layers/generate-boundaries.py
No network requests run during the application build or when viewing these layers.
Use --cache-dir to retain/reuse the exact upstream responses for reproducibility.
Install GDAL's ogr2ogr command before refreshing; it repairs generalized polygons.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request

from generate import EXTENT, OUTPUT, feature, save

WBD = 'https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4'
CENSUS = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4'
STATES = {'16': 'ID', '41': 'OR', '53': 'WA'}


def repair_features(features):
    # Server generalization can introduce crossed rings or detached holes. Keep
    # repaired intersections at full precision rather than rounding them again.
    with tempfile.TemporaryDirectory(prefix='atlas-boundaries-') as directory:
        original = Path(directory) / 'original.geojson'
        repaired = Path(directory) / 'repaired.geojson'
        original.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}), encoding='utf-8')
        subprocess.run(['ogr2ogr', '-f', 'GeoJSON', str(repaired), str(original),
                        '-makevalid', '-nlt', 'PROMOTE_TO_MULTI', '-lco', 'COORDINATE_PRECISION=15'],
                       check=True, capture_output=True, text=True)
        result = json.loads(repaired.read_text(encoding='utf-8'))['features']
    if len(result) != len(features) or {item['id'] for item in result} != {item['id'] for item in features}:
        raise ValueError('Polygon repair changed the selected feature IDs')
    for item in result:
        if item['geometry']['type'] not in ('Polygon', 'MultiPolygon') or not item['geometry']['coordinates']:
            raise ValueError('Polygon repair produced an empty or non-polygon feature')
    return result


def read_json(url, cache):
    path = cache / (hashlib.sha256(url.encode()).hexdigest() + '.json') if cache else None
    if path and path.exists():
        raw = path.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=120) as response:
            raw = response.read()
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    data = json.loads(raw)
    if 'error' in data:
        raise ValueError(f"Upstream error from {url}: {data['error']}")
    return data


def query(layer, params, cache):
    url = layer + '/query?' + urllib.parse.urlencode(params)
    return read_json(url, cache), url


def fetch_features(layer, where, fields, tolerance, cache, extent=False):
    metadata = read_json(layer + '?f=json', cache)
    params = {'f': 'json', 'where': where, 'returnIdsOnly': 'true'}
    if extent:
        params.update(geometry=','.join(map(str, EXTENT)), geometryType='esriGeometryEnvelope',
                      inSR=4326, spatialRel='esriSpatialRelIntersects')
    identifiers, selection_url = query(layer, params, cache)
    ids = sorted(identifiers['objectIds'])
    if not ids or len(set(ids)) != len(ids):
        raise ValueError('Missing or duplicate upstream feature IDs')
    id_field = identifiers['objectIdFieldName']
    features = []
    urls = [layer + '?f=json', selection_url]
    for offset in range(0, len(ids), 200):
        batch = ids[offset:offset + 200]
        data, url = query(layer, {
            'f': 'geojson', 'objectIds': ','.join(map(str, batch)),
            'outFields': ','.join([id_field, *fields]), 'outSR': 4326,
            'returnGeometry': 'true', 'maxAllowableOffset': tolerance, 'geometryPrecision': 5,
        }, cache)
        if data.get('exceededTransferLimit') or data.get('properties', {}).get('exceededTransferLimit'):
            raise ValueError('Upstream truncated the requested batch')
        items = data['features']
        returned_ids = [next(v for k, v in item['properties'].items() if k.lower() == id_field.lower()) for item in items]
        if len(items) != len(batch) or set(returned_ids) != set(batch):
            raise ValueError('Upstream response omitted or duplicated features')
        features.extend(items)
        urls.append(url)
    return features, urls, metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path)
    args = parser.parse_args()
    if not shutil.which('ogr2ogr'):
        parser.error('Boundary refresh requires ogr2ogr (GDAL with GEOS). Application builds do not need it.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    downloaded = datetime.now(timezone.utc).date().isoformat()

    items, urls, metadata = fetch_features(WBD,
        "states LIKE '%WA%' OR states LIKE '%OR%' OR states LIKE '%ID%'",
        ['huc8', 'name', 'states'], 0.006, args.cache_dir, extent=True)
    watersheds = []
    for item in items:
        props = {key.lower(): value for key, value in item['properties'].items()}
        watersheds.append(feature('huc8-' + props['huc8'], item['geometry'], {
            'name': props['name'], 'code': props['huc8'], 'states': props['states'],
            'kind': 'HUC8 subbasin', 'source': 'USGS Watershed Boundary Dataset',
        }))
    manifest['datasets']['watersheds'] = save('watersheds', repair_features(watersheds), urls, 'Public domain (USGS federal data)',
        'HUC8 subbasins associated with WA/OR/ID and intersecting the regional extent. Full drainage boundaries, not river channels; not clipped to state borders. Generalized at 0.006 degrees for display.')
    manifest['datasets']['watersheds'].update(downloaded=downloaded, serviceLayer=metadata['name'],
        geometryToleranceDegrees=0.006, geometryRepair='GDAL MakeValid; polygon components retained')

    items, urls, metadata = fetch_features(CENSUS, "STATE IN ('16','41','53')",
        ['GEOID', 'NAME', 'STATE'], 0.001, args.cache_dir)
    cities = []
    for item in items:
        props = {key.lower(): value for key, value in item['properties'].items()}
        cities.append(feature('place-' + props['geoid'], item['geometry'], {
            'name': props['name'], 'code': props['geoid'], 'states': STATES[props['state']],
            'kind': 'Incorporated place', 'source': 'U.S. Census Bureau TIGERweb',
        }))
    manifest['datasets']['cities'] = save('cities', repair_features(cities), urls, 'Public domain (U.S. Census Bureau federal data)',
        'Incorporated places in WA/OR/ID only. Excludes census-designated places and urban growth areas. Generalized at 0.001 degrees for display, not legal boundary determination.')
    manifest['datasets']['cities'].update(downloaded=downloaded, serviceLayer=metadata['name'],
        geometryToleranceDegrees=0.001, serviceDescription=metadata.get('description', ''),
        geometryRepair='GDAL MakeValid; polygon components retained')

    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    for name in ['watersheds', 'cities']:
        dataset = manifest['datasets'][name]
        print(f"{name}: {dataset['features']} features / {dataset['bytes']} bytes / {dataset['sha256']}")


if __name__ == '__main__':
    main()
