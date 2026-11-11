"""Build small, same-origin GeoJSON snapshots; never called by application builds.

Run with Python 3.10+: python scripts/builtin-layers/generate.py
Only the explicit refresh command downloads upstream data. Runtime uses the
committed public/data/builtin-layers files. No GIS packages are required.
"""
import hashlib
import json
from pathlib import Path
import urllib.request

OUTPUT = Path(__file__).resolve().parents[2] / 'public/data/builtin-layers'
# Includes bordering features; this is an extent selection, not a state-border clip.
EXTENT = [-125, 41.9, -110.8, 49.1]
NATURAL_EARTH_REF = 'ca96624a56bd078437bca8184e78163e5039ad19'
FOREST_REF = '2cfc36874b526e6dfc6fe38ad4aeb9b50da62f02'
NE_BASE = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NATURAL_EARTH_REF}/'
FOREST_BASE = f'https://raw.githubusercontent.com/Theodore-Roosevelt-Presidential-Library/PresidentialPublicLands/{FOREST_REF}/'


def download(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def positions(coordinates):
    if coordinates and isinstance(coordinates[0], (int, float)):
        yield coordinates
    else:
        for item in coordinates:
            yield from positions(item)


def intersects(geometry):
    points = list(positions(geometry['coordinates']))
    if not points:
        return False
    xs, ys = zip(*(point[:2] for point in points))
    return max(xs) >= EXTENT[0] and min(xs) <= EXTENT[2] and max(ys) >= EXTENT[1] and min(ys) <= EXTENT[3]


def rounded(coordinates):
    if isinstance(coordinates, (int, float)):
        return round(coordinates, 5)
    return [rounded(value) for value in coordinates]


def save(name, features, upstream, license_name, limitations):
    features.sort(key=lambda feature: str(feature['id']))
    collection = {'type': 'FeatureCollection', 'features': features}
    content = (json.dumps(collection, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    (OUTPUT / f'{name}.geojson').write_bytes(content)
    return {'file': f'{name}.geojson', 'features': len(features), 'bytes': len(content),
            'sha256': hashlib.sha256(content).hexdigest(), 'upstream': upstream,
            'license': license_name, 'limitations': limitations}


def feature(identifier, geometry, properties):
    return {'type': 'Feature', 'id': identifier, 'properties': properties,
            'geometry': {'type': geometry['type'], 'coordinates': rounded(geometry['coordinates'])}}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {
        'schemaVersion': 1, 'selectionExtent': EXTENT, 'coordinateSystem': 'WGS84 / EPSG:4326', 'datasets': {},
    }
    for name in ['lakes', 'roads']:
        upstream = NE_BASE + f'geojson/ne_10m_{name}.geojson'
        data = json.loads(download(upstream))
        selected = []
        for index, item in enumerate(data['features']):
            geometry, properties = item['geometry'], item['properties']
            if not intersects(geometry) or (name == 'roads' and properties.get('featurecla') != 'Road'):
                continue
            label = properties.get('name_en') or properties.get('name') or properties.get('label') or properties.get('type') or name.title()
            selected.append(feature(f'{name}-{index}', geometry, {
                'name': label, 'kind': properties.get('type') or properties.get('featurecla'), 'source': 'Natural Earth',
            }))
        manifest['datasets'][name] = save(name, selected, [upstream], 'Public domain',
            'Generalized 1:10 million overview. Extent-selected features may cross the WA/OR/ID region. Not a complete inventory or navigation data.')
    sites = {item['id']: item for item in json.loads(download(FOREST_BASE + 'data/sites.json'))}
    forest_data = json.loads(download(FOREST_BASE + 'data/lands.geojson'))
    selected = []
    for item in forest_data['features']:
        properties = item['properties']
        site = sites[properties['sid']]
        if properties['cat'] != 'forest' or not set(site.get('st', '').split('/')).intersection({'WA', 'OR', 'ID'}):
            continue
        selected.append(feature(properties['sid'], item['geometry'], {
            'name': site['name'], 'kind': 'National forest proclaimed boundary', 'states': site['st'],
            'source': 'USFS boundaries via Theodore Roosevelt Presidential Library',
        }))
    manifest['datasets']['forests'] = save('forests', selected,
        [FOREST_BASE + 'data/lands.geojson', FOREST_BASE + 'data/sites.json',
         'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_ProclaimedForestBoundaries_01/MapServer/0'],
        'MIT (mirror); original USFS federal data',
        'Selected simplified proclaimed national forest boundaries, via a historical-land-lineage collection. Not canopy coverage, ownership parcels, historical 1909 borders, or a complete/current forest inventory. Names can identify component forests.')
    (OUTPUT / 'NATURAL-EARTH-LICENSE.md').write_bytes(download(NE_BASE + 'LICENSE.md'))
    (OUTPUT / 'FORESTS-LICENSE.txt').write_bytes(download(FOREST_BASE + 'LICENSE'))
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    for name, data in manifest['datasets'].items():
        print(f"{name}: {data['features']} features / {data['bytes']} bytes")


if __name__ == '__main__':
    main()
