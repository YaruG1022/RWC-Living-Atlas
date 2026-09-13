// Keep the complete GeoJSON (including holes) for custom layers.
export function basinFeatureCollection(basin) {
    const features = basin?.type === 'FeatureCollection' ? basin.features
        : basin?.type === 'Feature' ? [basin]
            : basin?.type ? [{ type: 'Feature', properties: {}, geometry: basin }] : [];
    const polygons = features.filter(feature => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type));
    if (!polygons.length) throw new Error('No basin polygon is available. Delineate a watershed first.');
    return JSON.parse(JSON.stringify({ type: 'FeatureCollection', features: polygons }));
}

export function basinPolygonVertices(basin) {
    const polygons = basinFeatureCollection(basin).features.flatMap(({ geometry }) =>
        geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]);
    if (polygons.some(rings => rings.length > 1)) {
        throw new Error('This basin contains interior holes, which the polygon editor does not support. Use Save as custom layer to preserve the complete basin.');
    }
    return polygons.flatMap((rings, ring) => {
        const coordinates = rings[0] || [];
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const openRing = first && last && first[0] === last[0] && first[1] === last[1]
            ? coordinates.slice(0, -1) : coordinates;
        if (openRing.length < 3 || openRing.some(c => !Number.isFinite(c[0]) || !Number.isFinite(c[1]))) {
            throw new Error('The basin contains invalid polygon coordinates. Please delineate it again.');
        }
        return openRing.map(([lng, lat]) => ({ lng, lat, ring, fillColor: '#f5c542', fillOpacity: 0.3, lineStyle: 'solid' }));
    });
}
