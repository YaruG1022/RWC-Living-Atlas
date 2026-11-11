import { parseGeoFile } from './geoFileUtils';

const file = (name, text) => ({ name, text: async () => text });

test('reads GeoJSON features and preserves attributes', async () => {
    const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [-122, 47] }, properties: { name: 'Outlet' } };
    const result = await parseGeoFile(file('basin.geojson', '\uFEFF' + JSON.stringify(feature)));
    expect(result.features).toEqual([feature]);
});

test('keeps KML MultiGeometry polygons, inner holes, points and extended attributes', async () => {
    const text = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Basin</name><ExtendedData><Data name="Area"><value>42</value></Data><SchemaData><SimpleData name="Unit">km2</SimpleData></SchemaData></ExtendedData><MultiGeometry><Point><coordinates>-122,47,0</coordinates></Point><Polygon><outerBoundaryIs><LinearRing><coordinates>-123,47 -122,47 -122,48 -123,47</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>-122.8,47.1 -122.6,47.1 -122.6,47.2 -122.8,47.1</coordinates></LinearRing></innerBoundaryIs></Polygon><Polygon><outerBoundaryIs><LinearRing><coordinates>-121,47 -120,47 -120,48</coordinates></LinearRing></outerBoundaryIs></Polygon></MultiGeometry></Placemark></Document></kml>`;
    const result = await parseGeoFile(file('basin.kml', text));
    expect(result.features).toHaveLength(1);
    const feature = result.features[0];
    expect(feature.properties).toEqual({ name: 'Basin', Area: '42', Unit: 'km2' });
    expect(feature.geometry.geometries.map(geometry => geometry.type)).toEqual(['Point', 'Polygon', 'Polygon']);
    expect(feature.geometry.geometries[1].coordinates).toHaveLength(2);
    const ring = feature.geometry.geometries[2].coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
});

test('supports prefixed KML and rejects empty, malformed and unprojected data', async () => {
    const result = await parseGeoFile(file('point.kml', '<k:kml xmlns:k="http://www.opengis.net/kml/2.2"><k:Placemark><k:Point><k:coordinates>-122,47</k:coordinates></k:Point></k:Placemark></k:kml>'));
    expect(result.features[0].geometry.coordinates).toEqual([-122, 47]);
    await expect(parseGeoFile(file('empty.json', '{"type":"FeatureCollection","features":[]}'))).rejects.toThrow('no displayable');
    await expect(parseGeoFile(file('bad.kml', '<kml><broken>'))).rejects.toThrow('Invalid KML');
    await expect(parseGeoFile(file('projected.json', '{"type":"Point","coordinates":[1200000,700000]}'))).rejects.toThrow('longitude/latitude');
});
