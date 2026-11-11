/** Parse StreamStats GeoJSON, KML, or Shapefile ZIP into a WGS84 FeatureCollection. */
export async function parseGeoFile(file) {
    const name = file.name.toLowerCase();
    let data;
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
        data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    } else if (name.endsWith('.kml')) {
        data = kmlToGeoJSON(await file.text());
    } else if (name.endsWith('.zip')) {
        const shpjs = (await import('shpjs')).default;
        const result = await shpjs(await file.arrayBuffer());
        data = Array.isArray(result) ? { type: 'FeatureCollection', features: result.flatMap(item => item.features || []) } : result;
    } else {
        throw new Error('Unsupported format. Choose GeoJSON, KML, or a Shapefile ZIP.');
    }
    return normalizeToFeatureCollection(data);
}

function normalizeToFeatureCollection(data) {
    const collection = data?.type === 'FeatureCollection' ? data
        : data?.type === 'Feature' ? { type: 'FeatureCollection', features: [data] }
            : data?.type && (data.coordinates || data.geometries) ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: data, properties: {} }] } : null;
    if (!Array.isArray(collection?.features) || !collection.features.length) throw new Error('The file contains no displayable spatial features.');
    const validateCoordinates = coordinates => {
        if (!Array.isArray(coordinates) || !coordinates.length) throw new Error('The file contains empty or invalid geometry.');
        if (typeof coordinates[0] === 'number') {
            const [lon, lat] = coordinates;
            if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
                throw new Error('Coordinates must be WGS84 longitude/latitude. For projected GIS data, use GIS data (.zip) with its projection.');
            }
        } else coordinates.forEach(validateCoordinates);
    };
    const validateGeometry = geometry => {
        if (geometry?.type === 'GeometryCollection' && geometry.geometries?.length) geometry.geometries.forEach(validateGeometry);
        else if (['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(geometry?.type)) validateCoordinates(geometry.coordinates);
        else throw new Error('The file contains an unsupported or missing geometry.');
    };
    collection.features.forEach(feature => validateGeometry(feature?.geometry));
    return collection;
}

const directChildren = (node, name) => [...node.children].filter(child => child.localName === name);
const child = (node, name) => directChildren(node, name)[0];
const descendants = (node, name) => [...node.getElementsByTagNameNS('*', name)];

function parseCoordinates(node) {
    const text = child(node, 'coordinates')?.textContent.trim();
    if (!text) throw new Error('A KML geometry has no coordinates.');
    return text.split(/\s+/).map(tuple => {
        const values = tuple.split(',');
        const lon = Number(values[0]), lat = Number(values[1]);
        if (!values[0] || !values[1] || !Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error('Invalid KML coordinates.');
        return [lon, lat];
    });
}

function ring(boundary) {
    const linearRing = boundary && child(boundary, 'LinearRing');
    if (!linearRing) throw new Error('A KML polygon is missing its boundary.');
    const coordinates = parseCoordinates(linearRing);
    if (coordinates.length < 3) throw new Error('A KML polygon needs at least three vertices.');
    const first = coordinates[0], last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push([...first]);
    return coordinates;
}

function geometry(node) {
    if (node.localName === 'Point') return { type: 'Point', coordinates: parseCoordinates(node)[0] };
    if (node.localName === 'LineString') {
        const coordinates = parseCoordinates(node);
        if (coordinates.length < 2) throw new Error('A KML line needs at least two coordinates.');
        return { type: 'LineString', coordinates };
    }
    if (node.localName === 'Polygon') return {
        type: 'Polygon', coordinates: [ring(child(node, 'outerBoundaryIs')), ...directChildren(node, 'innerBoundaryIs').map(ring)],
    };
    if (node.localName === 'MultiGeometry') {
        const geometries = [...node.children].map(geometry).filter(Boolean);
        if (!geometries.length) throw new Error('The KML MultiGeometry contains no supported geometry.');
        return geometries.length === 1 ? geometries[0] : { type: 'GeometryCollection', geometries };
    }
    return null;
}

function kmlToGeoJSON(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (descendants(doc, 'parsererror').length) throw new Error('Invalid KML document.');
    const features = descendants(doc, 'Placemark').flatMap(placemark => {
        const properties = { name: child(placemark, 'name')?.textContent.trim() || '' };
        descendants(placemark, 'SimpleData').forEach(item => { properties[item.getAttribute('name')] = item.textContent; });
        descendants(placemark, 'Data').forEach(item => { properties[item.getAttribute('name')] = child(item, 'value')?.textContent || ''; });
        // Read direct geometry children so a MultiGeometry retains every polygon,
        // hole and pour point instead of accidentally keeping only its first point.
        return [...placemark.children].map(geometry).filter(Boolean).map(value => ({ type: 'Feature', geometry: value, properties }));
    });
    return { type: 'FeatureCollection', features };
}
