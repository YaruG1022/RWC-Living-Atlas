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
        assert(bytes.length < 2 * 1024 * 1024, 'Keep individual snapshots below 2 MiB');
        const data = JSON.parse(bytes);
        assert.equal(data.type, 'FeatureCollection');
        assert.equal(data.features.length, dataset.features);
        assert(data.features.length > 0);
        assert.equal(new Set(data.features.map(feature => feature.id)).size, data.features.length);
        for (const feature of data.features) {
            assert.equal(feature.type, 'Feature');
            assert(feature.properties.name && feature.properties.source && feature.properties.kind);
            const geometry = feature.geometry;
            const isLine = ['roads', 'rivers'].includes(name);
            assert((isLine ? ['LineString', 'MultiLineString'] : ['Polygon', 'MultiPolygon']).includes(geometry.type));
            assert(geometry.coordinates.length > 0, 'Geometry must not be empty');
            if (isLine) {
                const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
                assert(lines.every(line => line.length >= 2), 'Lines need at least two positions');
            }
            for (const [lon, lat] of points(geometry.coordinates)) {
                assert(Number.isFinite(lon) && lon >= -180 && lon <= 180);
                assert(Number.isFinite(lat) && lat >= -90 && lat <= 90);
            }
            const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : [];
            for (const ring of rings) {
                assert(ring.length >= 4);
                assert.deepEqual(ring[0], ring.at(-1));
                const area = ring.slice(1).reduce((sum, [x, y], i) => sum + ring[i][0] * y - x * ring[i][1], 0);
                assert(Math.abs(area) > 1e-12, 'Polygon rings must enclose an area');
            }
        }
    });
}

test('all snapshot licenses ship with the same-origin assets', () => {
    assert.match(fs.readFileSync(path.join(root, 'NATURAL-EARTH-LICENSE.md'), 'utf8'), /public domain/i);
    assert.match(fs.readFileSync(path.join(root, 'FORESTS-LICENSE.txt'), 'utf8'), /MIT License/);
    assert.match(fs.readFileSync(path.join(root, 'BOUNDARIES-LICENSE.md'), 'utf8'), /public domain/);
});

test('rivers snapshot includes major regional rivers and lake centerlines', () => {
    const rivers = JSON.parse(fs.readFileSync(path.join(root, 'rivers.geojson'))).features;
    for (const name of ['Columbia', 'Snake', 'Willamette']) {
        assert(rivers.some(item => item.properties.name === name));
    }
    assert(rivers.some(item => item.properties.kind === 'Lake Centerline'));
    assert(rivers.every(item => ['River', 'Lake Centerline'].includes(item.properties.kind)));
});

test('boundary snapshots retain HUC8/GEOID identifiers and cover all three states', () => {
    const cities = JSON.parse(fs.readFileSync(path.join(root, 'cities.geojson'))).features;
    const watersheds = JSON.parse(fs.readFileSync(path.join(root, 'watersheds.geojson'))).features;
    assert.deepEqual([...new Set(cities.map(item => item.properties.states))].sort(), ['ID', 'OR', 'WA']);
    for (const [name, state] of [['Seattle', 'WA'], ['Portland', 'OR'], ['Boise', 'ID']]) {
        assert(cities.some(item => item.properties.name.includes(name) && item.properties.states === state));
    }
    for (const item of cities) {
        assert.match(item.properties.code, /^(16|41|53)\d{5}$/);
        assert.equal(item.properties.kind, 'Incorporated place');
        assert.equal(item.id, `place-${item.properties.code}`);
    }
    for (const item of watersheds) {
        assert.match(item.properties.code, /^\d{8}$/);
        assert.equal(item.properties.kind, 'HUC8 subbasin');
        assert.equal(item.id, `huc8-${item.properties.code}`);
        assert(/WA|OR|ID/.test(item.properties.states));
    }
});
