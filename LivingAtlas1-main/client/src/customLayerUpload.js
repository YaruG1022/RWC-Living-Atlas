import api from './api';
import { parseGeoFile } from './geoFileUtils';

export const UPLOAD_FORMATS = [
    { id: 'gis', label: 'GIS data (.zip)', description: 'File Geodatabase or Shapefile', accept: '.zip' },
    { id: 'geojson', label: 'GeoJSON (.geojson / .json)', accept: '.geojson,.json' },
    { id: 'kml', label: 'KML (.kml)', accept: '.kml' },
    { id: 'shapefile', label: 'Shapefile (.zip)', accept: '.zip' },
];

export async function readCustomLayerFile(file, format) {
    const option = UPLOAD_FORMATS.find(item => item.id === format);
    if (!option || !option.accept.split(',').some(extension => file.name.toLowerCase().endsWith(extension))) {
        throw new Error(`Choose a ${option?.accept || 'supported GIS'} file for this upload type.`);
    }
    if (file.size > 25 * 1024 * 1024) throw new Error('The file exceeds the 25 MB upload limit.');
    if (format === 'gis' || format === 'shapefile') {
        const form = new FormData();
        form.append('file', file);
        const response = await api.post('/arcgis/custom-layers/import-gis', form, { timeout: 120000, skipRetry: true });
        if (!Array.isArray(response.data?.layers) || !response.data.layers.length) throw new Error('No spatial layers were found in the GIS ZIP.');
        return response.data;
    }
    return { layers: [{ name: file.name.replace(/\.[^.]+$/, ''), geojson: await parseGeoFile(file) }], warnings: [] };
}

export function uploadedGeojsonBounds(collections) {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    const coordinates = value => {
        if (typeof value?.[0] === 'number') {
            const [lon, lat] = value;
            if (Number.isFinite(lon) && Number.isFinite(lat)) {
                bounds[0] = Math.min(bounds[0], lon); bounds[1] = Math.min(bounds[1], lat);
                bounds[2] = Math.max(bounds[2], lon); bounds[3] = Math.max(bounds[3], lat);
            }
        } else value?.forEach(coordinates);
    };
    const geometry = item => {
        if (item?.type === 'GeometryCollection') item.geometries.forEach(geometry);
        else coordinates(item?.coordinates);
    };
    collections.forEach(collection => collection.features?.forEach(feature => geometry(feature.geometry)));
    return bounds.every(Number.isFinite) ? [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] : null;
}
