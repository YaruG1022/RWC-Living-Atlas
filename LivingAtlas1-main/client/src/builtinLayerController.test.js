import { waitFor } from '@testing-library/react';
import mapboxgl from 'mapbox-gl';
import { installBuiltinLayers, getBuiltinLayerStatuses, setLocalBuiltinVisibility } from './builtinLayerController';
import { BUILTIN_LAYERS, LOCAL_BUILTIN_LAYERS } from './builtinLayers';

jest.mock('mapbox-gl', () => ({ __esModule: true, default: { Popup: jest.fn() } }));
const data = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-120, 47], [-119, 47]] }, properties: { name: '<img src=x onerror=alert(1)>' } }] };
const response = () => ({ ok: true, json: async () => data });

function createMap() {
    const events = [];
    const map = {
        style: { sources: {}, layers: [{ id: 'labels', type: 'symbol', layout: { 'text-field': 'name' } }] },
        ready: true,
        canvas: { style: {} },
        isStyleLoaded: () => map.ready,
        getStyle: () => map.style,
        getCanvas: () => map.canvas,
        getSource: id => map.style.sources[id],
        getLayer: id => map.style.layers.find(layer => layer.id === id),
        getLayoutProperty: (id, name) => map.getLayer(id)?.layout[name],
        addSource: jest.fn((id, source) => { map.style.sources[id] = source; }),
        addLayer: jest.fn(layer => { map.style.layers.push(layer); }),
        setPaintProperty: jest.fn((id, name, value) => { map.getLayer(id).paint[name] = value; }),
        setLayoutProperty: jest.fn((id, name, value) => { map.getLayer(id).layout[name] = value; }),
        on: jest.fn((...args) => events.push(args)),
        off: jest.fn((...args) => { const index = events.findIndex(item => item.every((value, i) => value === args[i])); if (index !== -1) events.splice(index, 1); }),
        emit: (name, payload, layer) => events.filter(item => item[0] === name && (layer ? item[1] === layer : item.length === 2)).forEach(item => item.at(-1)(payload)),
    };
    return map;
}

test('loads each local layer only when enabled, and caches data when toggled again', async () => {
    const map = createMap();
    const fetchData = jest.fn(async () => response());
    const controller = installBuiltinLayers(map, fetchData);
    expect(fetchData).not.toHaveBeenCalled();
    for (const layer of LOCAL_BUILTIN_LAYERS) {
        expect(setLocalBuiltinVisibility(map, layer.id, true)).toBe(true);
        await waitFor(() => expect(getBuiltinLayerStatuses(map)[layer.id].state).toBe('ready'));
        expect(fetchData).toHaveBeenLastCalledWith(`/data/builtin-layers/${layer.file}`, expect.objectContaining({ signal: expect.anything() }));
        layer.layerIds.forEach(id => expect(map.getLayoutProperty(id, 'visibility')).toBe('visible'));
        controller.setVisible(layer.id, false);
        layer.layerIds.forEach(id => expect(map.getLayoutProperty(id, 'visibility')).toBe('none'));
        controller.setVisible(layer.id, true);
    }
    expect(fetchData).toHaveBeenCalledTimes(6);
    expect(setLocalBuiltinVisibility(map, 'unknown', true)).toBe(false);
    controller.destroy();
});

test('unchecking during a pending download does not show the late result', async () => {
    const map = createMap();
    let finish;
    const fetchData = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const controller = installBuiltinLayers(map, fetchData);
    controller.setVisible('Forest', true);
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    controller.setVisible('Forest', false);
    finish(response());
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Forest.state).toBe('ready'));
    expect(map.addSource).not.toHaveBeenCalled();
    controller.setVisible('Forest', true);
    expect(map.getLayoutProperty('builtin-forest-fill', 'visibility')).toBe('visible');
    expect(fetchData).toHaveBeenCalledTimes(1);
    controller.destroy();
});

test('data fetched before style readiness attaches on idle and survives repeated basemap changes', async () => {
    const map = createMap();
    map.ready = false;
    const fetchData = jest.fn(async () => response());
    const controller = installBuiltinLayers(map, fetchData);
    controller.setVisible('Lake', true);
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Lake.state).toBe('ready'));
    expect(map.addSource).not.toHaveBeenCalled();
    map.ready = true;
    map.emit('idle');
    expect(map.getLayer('builtin-lake-fill')).toBeDefined();
    for (let i = 0; i < 2; i++) {
        map.style = { sources: {}, layers: [] };
        map.emit('style.load');
        map.emit('idle');
        expect(map.style.layers).toHaveLength(2);
        expect(map.getLayoutProperty('builtin-lake-fill', 'visibility')).toBe('visible');
    }
    const mutations = map.setLayoutProperty.mock.calls.length;
    map.emit('idle');
    expect(map.setLayoutProperty).toHaveBeenCalledTimes(mutations);
    expect(fetchData).toHaveBeenCalledTimes(1);
    controller.destroy();
});

test.each(['http', 'invalid'])('reports %s data errors and allows explicit retry', async failure => {
    const map = createMap();
    const fetchData = jest.fn().mockResolvedValueOnce(failure === 'http' ? { ok: false } : { ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) }).mockResolvedValueOnce(response());
    const controller = installBuiltinLayers(map, fetchData);
    controller.setVisible('Roads', true);
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Roads.state).toBe('error'));
    expect(map.addSource).not.toHaveBeenCalled();
    controller.retry('Roads');
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Roads.state).toBe('ready'));
    expect(map.getLayer('builtin-roads-line')).toBeDefined();
    controller.destroy();
});

test('popups render source properties as text and cleanup removes handlers and aborts requests', async () => {
    const popup = { setLngLat: jest.fn().mockReturnThis(), setDOMContent: jest.fn().mockReturnThis(), addTo: jest.fn().mockReturnThis(), remove: jest.fn() };
    mapboxgl.Popup.mockImplementation(() => popup);
    const map = createMap();
    const fetchData = jest.fn(async () => response());
    const controller = installBuiltinLayers(map, fetchData);
    controller.setVisible('Roads', true);
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Roads.state).toBe('ready'));
    map.emit('click', { features: data.features, lngLat: [-120, 47] }, 'builtin-roads-line');
    const content = popup.setDOMContent.mock.calls[0][0];
    expect(content.querySelector('img')).toBeNull();
    expect(content.textContent).toContain('<img src=x');
    const signal = fetchData.mock.calls[0][1].signal;
    controller.destroy();
    expect(signal.aborted).toBe(true);
    expect(popup.remove).toHaveBeenCalled();
    expect(getBuiltinLayerStatuses(map)).toEqual({});
    const count = map.addLayer.mock.calls.length;
    map.emit('style.load');
    expect(map.addLayer).toHaveBeenCalledTimes(count);
});

test('the catalog preserves legacy IDs and uses unique overlay IDs for every new category', () => {
    expect(BUILTIN_LAYERS.map(layer => layer.id)).toEqual(['River', 'Rivers', 'Places', 'Forest', 'Lake', 'Roads']);
    const ids = BUILTIN_LAYERS.flatMap(layer => layer.layerIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LOCAL_BUILTIN_LAYERS.every(layer => !layer.file.includes('://'))).toBe(true);
});


test('opacity applies to already loaded layers and to layers enabled later', async () => {
    const map = createMap();
    const controller = installBuiltinLayers(map, jest.fn(async () => response()));
    controller.setVisible('Forest', true);
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Forest.state).toBe('ready'));
    controller.setOpacity(0.5);
    expect(map.getLayer('builtin-forest-fill').paint['fill-opacity']).toBeCloseTo(0.175);
    expect(map.getLayer('builtin-forest-outline').paint['line-opacity']).toBe(0.5);
    controller.setVisible('Roads', true);
    await waitFor(() => expect(getBuiltinLayerStatuses(map).Roads.state).toBe('ready'));
    expect(map.getLayer('builtin-roads-line').paint['line-opacity']).toBe(0.5);
    controller.setOpacity(0);
    expect(map.getLayer('builtin-roads-line').paint['line-opacity']).toBe(0);
    controller.destroy();
});

test.each(['River', 'Places'])('%s uses local polygons, matching legends and opacity after a basemap change', async id => {
    const map = createMap();
    const fetchData = jest.fn(async () => response());
    const controller = installBuiltinLayers(map, fetchData);
    const layer = BUILTIN_LAYERS.find(item => item.id === id);
    controller.setOpacity(0.4);
    controller.setVisible(id, true);
    await waitFor(() => expect(getBuiltinLayerStatuses(map)[id].state).toBe('ready'));
    for (let change = 0; change < 2; change++) {
        const fill = map.getLayer(layer.layerIds[0]);
        const outline = map.getLayer(layer.layerIds[1]);
        expect(fill.paint['fill-color']).toBe(layer.color);
        expect(fill.paint['fill-opacity']).toBeCloseTo(0.4 * layer.fillOpacity);
        expect(outline.paint['line-color']).toBe(layer.color);
        expect(outline.paint['line-opacity']).toBe(0.4);
        expect(map.getSource(fill.source).type).toBe('geojson');
        map.style = { sources: {}, layers: [] };
        map.emit('style.load');
    }
    expect(fetchData).toHaveBeenCalledTimes(1);
    controller.setVisible(id, false);
    layer.layerIds.forEach(layerId => expect(map.getLayoutProperty(layerId, 'visibility')).toBe('none'));
    controller.destroy();
});
