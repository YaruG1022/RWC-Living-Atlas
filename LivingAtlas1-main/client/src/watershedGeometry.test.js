import { basinFeatureCollection, basinPolygonVertices } from './watershedGeometry';

const ring = [[-117, 46], [-116, 46], [-116, 47], [-117, 46]];

test('preserves separate MultiPolygon components and removes duplicate closing vertices', () => {
    const geometry = { type: 'MultiPolygon', coordinates: [[ring], [ring]] };
    expect(basinFeatureCollection(geometry).features[0].geometry).toEqual(geometry);
    const vertices = basinPolygonVertices(geometry);
    expect(vertices).toHaveLength(6);
    expect(vertices.map(v => v.ring)).toEqual([0, 0, 0, 1, 1, 1]);
});

test('keeps holes in custom GeoJSON and prevents silently filling them in the editor', () => {
    const geometry = { type: 'Polygon', coordinates: [ring, ring] };
    expect(basinFeatureCollection(geometry).features[0].geometry.coordinates).toHaveLength(2);
    expect(() => basinPolygonVertices(geometry)).toThrow('interior holes');
});

test('rejects missing polygons and invalid vertices', () => {
    expect(() => basinFeatureCollection(null)).toThrow('No basin polygon');
    expect(() => basinPolygonVertices({ type: 'Polygon', coordinates: [[]] })).toThrow('invalid');
});
