const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../public/data/builtin-layers');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));

function points(coordinates) {
    return typeof coordinates[0] === 'number' ? [coordinates] : coordinates.flatMap(points);
}

for (const [name, dataset] of Object.entries(manifest.datasets)) {
    test(`${name}: shipped data has valid geometry, stable IDs, license and a matching checksum`, () => {
        assert.match(dataset.file, /^[a-z]+\.geojson$/);
        assert(dataset.upstream.every(url => url.startsWith('https://')));
        assert(dataset.license && dataset.limitations);
        const bytes = fs.readFileSync(path.join(root, dataset.file));
        assert.equal(bytes.length, dataset.bytes);
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), dataset.sha256);
        assert(bytes.length < 1024 * 1024, 'Keep individual snapshots below 1 MiB');
        const data = JSON.parse(bytes);
        assert.equal(data.type, 'FeatureCollection');
        assert.equal(data.features.length, dataset.features);
        assert(data.features.length > 0);
        assert.equal(new Set(data.features.map(feature => feature.id)).size, data.features.length);
        for (const feature of data.features) {
            assert.equal(feature.type, 'Feature');
            assert(feature.properties.name && feature.properties.source && feature.properties.kind);
            const geometry = feature.geometry;
            assert((name === 'roads' ? ['LineString', 'MultiLineString'] : ['Polygon', 'MultiPolygon']).includes(geometry.type));
            for (const [lon, lat] of points(geometry.coordinates)) {
                assert(Number.isFinite(lon) && lon >= -180 && lon <= 180);
                assert(Number.isFinite(lat) && lat >= -90 && lat <= 90);
            }
            const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : [];
            for (const ring of rings) {
                assert(ring.length >= 4);
                assert.deepEqual(ring[0], ring.at(-1));
            }
        }
    });
}

test('all snapshot licenses ship with the same-origin assets', () => {
    assert.match(fs.readFileSync(path.join(root, 'NATURAL-EARTH-LICENSE.md'), 'utf8'), /public domain/i);
    assert.match(fs.readFileSync(path.join(root, 'FORESTS-LICENSE.txt'), 'utf8'), /MIT License/);
});
