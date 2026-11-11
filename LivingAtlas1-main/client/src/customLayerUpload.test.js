import { readCustomLayerFile, uploadedGeojsonBounds } from './customLayerUpload';
import api from './api';
import { parseGeoFile } from './geoFileUtils';

jest.mock('./api', () => ({ post: jest.fn() }));
jest.mock('./geoFileUtils', () => ({ parseGeoFile: jest.fn() }));
const geojson = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-122, 47] } }] };

test.each(['gis', 'shapefile'])('%s ZIPs use the projection-aware converter and retain individual layers', async format => {
    api.post.mockResolvedValue({ data: { layers: [{ name: 'Areas', geojson }, { name: 'Outlets', geojson }], warnings: [] } });
    const file = new File(['zip'], 'areas.zip');
    const result = await readCustomLayerFile(file, format);
    expect(result.layers).toHaveLength(2);
    const [url, body, config] = api.post.mock.calls[0];
    expect(url).toBe('/arcgis/custom-layers/import-gis');
    expect(body.get('file')).toBe(file);
    expect(config.skipRetry).toBe(true);
    expect(parseGeoFile).not.toHaveBeenCalled();
});

test.each([['geojson', 'basin.geojson'], ['geojson', 'basin.json'], ['kml', 'basin.kml']])('StreamStats %s format parses %s without a GIS request', async (format, name) => {
    parseGeoFile.mockResolvedValue(geojson);
    expect((await readCustomLayerFile(new File(['data'], name), format)).layers[0].geojson).toBe(geojson);
    expect(api.post).not.toHaveBeenCalled();
});

test('rejects wrong extensions and excessive sizes before reading or uploading', async () => {
    await expect(readCustomLayerFile(new File(['x'], 'bad.txt'), 'gis')).rejects.toThrow('Choose a .zip');
    await expect(readCustomLayerFile({ name: 'large.zip', size: 26 * 1024 * 1024 }, 'gis')).rejects.toThrow('25 MB');
    expect(api.post).not.toHaveBeenCalled();
});

test('bounds include all components of collections, multipolygons and points', () => {
    const collection = { features: [{ geometry: { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [-122, 47] }, { type: 'MultiPolygon', coordinates: [[[[-123, 46], [-121, 46], [-121, 48], [-123, 46]]]] }] } }] };
    expect(uploadedGeojsonBounds([collection])).toEqual([[-123, 46], [-121, 48]]);
});
