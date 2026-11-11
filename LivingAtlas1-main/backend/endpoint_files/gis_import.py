"""Convert bounded, read-only GIS ZIP uploads to map-ready WGS84 GeoJSON.

GDAL reads the archive through /vsizip; uploaded paths are never extracted,
executed or passed to a shell. The archive is removed after conversion.
"""
import json
import logging
import math
from pathlib import PurePosixPath
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore
from zipfile import BadZipFile, ZIP_DEFLATED, ZIP_STORED, ZipFile

import fiona
from fiona.model import to_dict
from fiona.transform import transform_geom
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix='/arcgis/custom-layers', tags=['Custom GIS uploads'])
MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
MAX_EXPANDED_BYTES = 100 * 1024 * 1024
MAX_FILES = 2000
MAX_LAYERS = 20
MAX_FEATURES = 100000
MAX_COORDINATES = 2000000
MAX_OUTPUT_BYTES = 20 * 1024 * 1024
_IMPORT_SLOT = BoundedSemaphore(1)


def invalid(message, status=400):
    raise HTTPException(status_code=status, detail=message)


def archive_datasets(path):
    """Validate every entry before handing the file to the native GIS reader."""
    with ZipFile(path) as archive:
        members = archive.infolist()
        if not members or len(members) > MAX_FILES:
            invalid('The GIS ZIP is empty or contains too many files.')
        if sum(item.file_size for item in members) > MAX_EXPANDED_BYTES:
            invalid('The GIS ZIP expands beyond the 100 MB limit.', 413)
        names = {}
        gdbs = set()
        inflated = 0
        for item in members:
            name = item.filename
            parts = PurePosixPath(name).parts
            if (not parts or name.startswith(('/', '\\')) or '\\' in name or ':' in parts[0]
                    or '..' in parts or '\x00' in name or (item.external_attr >> 16) & 0o170000 == 0o120000):
                invalid('The GIS ZIP contains an unsafe file path.')
            if item.flag_bits & 1:
                invalid('Encrypted ZIP files are not supported. Upload an unencrypted GIS archive.')
            if item.compress_type not in (ZIP_STORED, ZIP_DEFLATED):
                invalid('Recompress the GIS data as a standard ZIP (stored or deflated).')
            if item.is_dir():
                continue
            if name.lower() in names:
                invalid('The GIS ZIP contains duplicate file paths.')
            names[name.lower()] = name
            # Reading also checks CRC and actual expanded size, without extraction.
            with archive.open(item) as contents:
                while chunk := contents.read(1024 * 1024):
                    inflated += len(chunk)
                    if inflated > MAX_EXPANDED_BYTES:
                        invalid('The GIS ZIP expands beyond the 100 MB limit.', 413)
            if parts[0] == '__MACOSX':
                continue
            for index, part in enumerate(parts):
                if part.lower().endswith('.gdb'):
                    gdbs.add('/'.join(parts[:index + 1]))
                    break
        datasets = [(name, 'OpenFileGDB') for name in sorted(gdbs)]
        for lower, name in sorted(names.items()):
            if lower.startswith('__macosx/') or not lower.endswith('.shp') or any(part.lower().endswith('.gdb') for part in PurePosixPath(name).parts):
                continue
            if any(lower[:-4] + extension not in names for extension in ['.shx', '.dbf', '.prj']):
                invalid('Each Shapefile must include matching .shp, .shx, .dbf and .prj files in the ZIP.')
            datasets.append((name, 'ESRI Shapefile'))
        if not datasets:
            invalid('No supported GIS dataset found. ZIP a File Geodatabase (.gdb folder) or a Shapefile with its companion files.')
        if len(datasets) > MAX_LAYERS:
            invalid('A GIS ZIP can contain at most 20 spatial layers.')
        return datasets


def property_value(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return value.isoformat() if hasattr(value, 'isoformat') else str(value)


def map_geometry(geometry, budget, bounds):
    def coordinates(value):
        if value and isinstance(value[0], (float, int)):
            lon, lat = value[:2]
            if not math.isfinite(lon) or not math.isfinite(lat) or not -180 <= lon <= 180 or not -90 <= lat <= 90:
                invalid('The GIS coordinates could not be converted to longitude/latitude. Check the dataset projection.')
            budget['coordinates'] += 1
            if budget['coordinates'] > MAX_COORDINATES:
                invalid('The GIS data has too many coordinates. Simplify it or upload a smaller area.', 413)
            bounds[0], bounds[1] = min(bounds[0], lon), min(bounds[1], lat)
            bounds[2], bounds[3] = max(bounds[2], lon), max(bounds[3], lat)
            return [lon, lat]
        return [coordinates(part) for part in value]
    if geometry['type'] == 'GeometryCollection':
        return {'type': 'GeometryCollection', 'geometries': [map_geometry(item, budget, bounds) for item in geometry['geometries']]}
    return {'type': geometry['type'], 'coordinates': coordinates(geometry['coordinates'])}


def convert_archive(path):
    datasets = archive_datasets(path)
    layers, warnings = [], []
    budget = {'coordinates': 0, 'features': 0, 'bytes': 0}
    with fiona.Env(PROJ_NETWORK='OFF'):
        for dataset, driver in datasets:
            virtual_path = f'/vsizip/{path}/{dataset}'
            names = fiona.listlayers(virtual_path, enabled_drivers=[driver])
            for name in names:
                if len(layers) >= MAX_LAYERS:
                    invalid('A GIS ZIP can contain at most 20 spatial layers.')
                with fiona.open(virtual_path, layer=name, enabled_drivers=[driver]) as source:
                    if source.schema.get('geometry') in (None, 'None'):
                        warnings.append(f'Skipped non-spatial table: {name}')
                        continue
                    if not source.crs:
                        invalid(f'Layer "{name}" has no coordinate reference system. Include its projection before uploading.')
                    features = []
                    bounds = [math.inf, math.inf, -math.inf, -math.inf]
                    skipped = 0
                    for item in source:
                        if not item.geometry:
                            skipped += 1
                            continue
                        budget['features'] += 1
                        if budget['features'] > MAX_FEATURES:
                            invalid('The GIS ZIP exceeds 100,000 features. Upload a smaller dataset.', 413)
                        transformed = to_dict(transform_geom(source.crs, 'EPSG:4326', item.geometry))
                        coordinate_count = budget['coordinates']
                        geometry = map_geometry(transformed, budget, bounds)
                        if budget['coordinates'] == coordinate_count:
                            skipped += 1
                            continue
                        feature = {'type': 'Feature', 'properties': {key: property_value(value) for key, value in item.properties.items()},
                                   'geometry': geometry}
                        budget['bytes'] += len(json.dumps(feature, ensure_ascii=False, allow_nan=False).encode())
                        if budget['bytes'] > MAX_OUTPUT_BYTES:
                            invalid('The converted GIS data exceeds 20 MB. Simplify it or upload a smaller area.', 413)
                        features.append(feature)
                    if skipped:
                        warnings.append(f'Layer "{name}": skipped {skipped} features without geometry.')
                    if features:
                        layers.append({'name': name, 'feature_count': len(features), 'bounds': bounds,
                                       'geojson': {'type': 'FeatureCollection', 'features': features}})
                    else:
                        warnings.append(f'Skipped empty spatial layer: {name}')
    if not layers:
        invalid('The GIS ZIP contains no displayable spatial features.')
    return {'layers': layers, 'warnings': warnings}


@router.post('/import-gis')
def import_gis(file: UploadFile = File(...)):
    if not (file.filename or '').lower().endswith('.zip'):
        invalid('Choose a GIS ZIP containing a File Geodatabase or Shapefile.')
    if not _IMPORT_SLOT.acquire(blocking=False):
        invalid('The GIS importer is busy. Please try again shortly.', 429)
    try:
        with TemporaryDirectory(prefix='atlas-gis-') as directory:
            path = f'{directory}/upload.zip'
            total = 0
            with open(path, 'wb') as target:
                while chunk := file.file.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_ARCHIVE_BYTES:
                        invalid('The GIS ZIP exceeds the 25 MB upload limit.', 413)
                    target.write(chunk)
            return convert_archive(path)
    except HTTPException:
        raise
    except (BadZipFile, EOFError):
        invalid('This ZIP is damaged or is not a valid GIS archive.')
    except Exception:
        logging.getLogger(__name__).exception('Unable to convert GIS ZIP')
        invalid('Unable to read this GIS ZIP. Check that it contains a readable File Geodatabase or complete Shapefile with a valid projection.', 422)
    finally:
        _IMPORT_SLOT.release()
