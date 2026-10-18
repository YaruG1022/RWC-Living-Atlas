import React from 'react';
import mapboxgl from 'mapbox-gl';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WatershedPanel from './WatershedPanel';
import { saveCustomLayer } from './arcgisServicesDb';
import PolygonDrawingModal from './PolygonDrawingModal';
import BasemapPanelOnboarding from './OnboardingBasemapPanel';

jest.mock('./arcgisServicesDb', () => ({ saveCustomLayer: jest.fn() }));
jest.mock('./PolygonDrawingModal', () => jest.fn(() => <div role="dialog">Edit Polygon</div>));

jest.mock('mapbox-gl', () => ({
    __esModule: true,
    default: { Marker: jest.fn(), Popup: jest.fn() },
}));

function mockMarker(options = {}) {
    const element = options.element || document.createElement('div');
    return {
        element,
        popup: null,
        setLngLat: jest.fn(function (coordinates) {
            this.coordinates = coordinates;
            this.popup?.setLngLat(coordinates);
            return this;
        }),
        setPopup: jest.fn(function (popup) { this.popup = popup; return this; }),
        addTo: jest.fn(function (map) { map.__container.appendChild(element); return this; }),
        getElement: jest.fn(() => element),
        remove: jest.fn(function () { element.remove(); this.popup?.remove(); return this; }),
    };
}

function mockPopup(options = {}) {
    const element = document.createElement('div');
    element.className = options.className || '';
    return {
        element,
        setLngLat: jest.fn(function (coordinates) { this.coordinates = coordinates; return this; }),
        setDOMContent: jest.fn(function (content) {
            this.content = content;
            element.textContent = '';
            element.appendChild(content);
            return this;
        }),
        addTo: jest.fn(function (map) { map.__container.appendChild(element); return this; }),
        remove: jest.fn(() => { element.remove(); }),
    };
}

const originalFetch = global.fetch;


beforeEach(() => {
    mapboxgl.Marker.mockImplementation(mockMarker);
    mapboxgl.Popup.mockImplementation(mockPopup);
    global.fetch = jest.fn();
    PolygonDrawingModal.mockImplementation(() => <div role="dialog">Edit Polygon</div>);
    Element.prototype.scrollIntoView = jest.fn();
});

test('walks through all watershed steps without a basin or saving data', () => {
    saveCustomLayer.mockClear();
    render(<WatershedPanel isOpen mapInstance={createMap()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Watershed tutorial' }));
    expect(screen.getByRole('dialog', { name: 'Watershed Delineation' })).toBeTruthy();
    for (let step = 1; step < 9; step++) {
        expect(screen.getByText(`Step ${step} of 9`)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText('Clear the Temporary Result')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saveCustomLayer).not.toHaveBeenCalled();
});

test('keeps the basemap tutorial default steps when using the shared walkthrough', () => {
    const close = jest.fn();
    render(<BasemapPanelOnboarding isOpen onClose={close} />);
    expect(screen.getByText('Step 1 of 7')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Help Button')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
});

afterEach(() => {
    global.fetch = originalFetch;
    document.querySelectorAll('[data-testid="watershed-map"]').forEach(element => element.remove());
});

function chooseSaveOption(name) {
    const trigger = screen.getByRole('button', { name: 'Save watershed' });
    if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name }));
}

function createMap() {
    const sources = {};
    const layers = {};
    const listeners = {};
    const container = document.createElement('div');
    container.dataset.testid = 'watershed-map';
    document.body.appendChild(container);
    const canvas = { style: {} };
    return {
        __container: container,
        getCanvas: () => canvas,
        getZoom: () => 14,
        fitBounds: jest.fn(),
        getSource: id => sources[id],
        getStyle: () => ({ sources }),
        getLayer: id => layers[id],
        addSource: jest.fn((id, source) => { sources[id] = source; }),
        addLayer: jest.fn(layer => { layers[layer.id] = layer; }),
        removeSource: id => { delete sources[id]; },
        removeLayer: id => { delete layers[id]; },
        setLayoutProperty: (id, key, value) => {
            layers[id].layout = { ...layers[id].layout, [key]: value };
        },
        isStyleLoaded: jest.fn(() => true),
        on: (event, handler) => { (listeners[event] ||= new Set()).add(handler); },
        once: (event, handler) => { (listeners[event] ||= new Set()).add(handler); },
        off: (event, handler) => listeners[event]?.delete(handler),
        emit: (event, data) => listeners[event]?.forEach(handler => handler(data)),
        resetStyle: () => {
            Object.keys(sources).forEach(id => delete sources[id]);
            Object.keys(layers).forEach(id => delete layers[id]);
        },
    };
}

test('toggles rivers during tile loading and switches the selected state', () => {
    const map = createMap();
    render(<WatershedPanel isOpen mapInstance={map} />);
    const toggle = screen.getByRole('checkbox', { name: 'Show StreamStats rivers' });
    expect(map.addSource).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(map.getSource('streamstats-rivers-WA').tiles[0]).toContain('layers=show:152');
    map.isStyleLoaded.mockReturnValue(false);
    fireEvent.click(toggle);
    expect(map.getLayer('streamstats-rivers-WA').layout.visibility).toBe('none');
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ID' } });
    expect(map.getLayer('streamstats-rivers-WA').layout.visibility).toBe('none');
    expect(map.getLayer('streamstats-rivers-ID').layout.visibility).toBe('visible');
    expect(map.getSource('streamstats-rivers-ID').tiles[0]).toContain('layers=show:46');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'OR' } });
    expect(map.getSource('streamstats-rivers-OR').tiles[0]).toContain('layers=show:119');
    expect(map.getLayer('streamstats-rivers-ID').layout.visibility).toBe('none');
});

const sampleBasin = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { name: 'basin' }, geometry: {
        type: 'Polygon', coordinates: [[[-117, 46], [-116, 46], [-116, 47], [-117, 46]]],
    } }],
};

function renderBasinPanel(extraProps = {}) {
    const map = createMap();
    map.addSource('streamstats-basin', { type: 'geojson', data: sampleBasin });
    return render(<WatershedPanel isOpen mapInstance={map} isLoggedIn userEmail="test@example.com" {...extraProps} />);
}

test('saves the complete basin to Root and refreshes custom layers only after success', async () => {
    saveCustomLayer.mockReset().mockResolvedValue({});
    const refreshed = jest.fn();
    renderBasinPanel({ onCustomLayerSaved: refreshed });
    fireEvent.change(screen.getByLabelText('Basin name'), { target: { value: 'My watershed' } });
    chooseSaveOption('Save as custom layer');
    await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
    expect(saveCustomLayer).toHaveBeenCalledWith('test@example.com', expect.objectContaining({
        label: 'My watershed', folder: 'Root', type: 'uploaded', geojson: sampleBasin,
    }));
    expect(screen.getByRole('status').textContent).toContain('Custom Layers / Root');
});

test('failed custom save keeps the basin available for retry', async () => {
    saveCustomLayer.mockReset().mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue({});
    const refreshed = jest.fn();
    renderBasinPanel({ onCustomLayerSaved: refreshed });
    chooseSaveOption('Save as custom layer');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Save failed'));
    expect(refreshed).not.toHaveBeenCalled();
    chooseSaveOption('Save as custom layer');
    await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
});

test('loads basin vertices into the editor then continues through the existing card event', () => {
    renderBasinPanel();
    chooseSaveOption('Save as polygon');
    expect(screen.getByRole('dialog')).toBeTruthy();
    const editor = PolygonDrawingModal.mock.calls.at(-1)[0];
    expect(editor.initialVertices.map(({ lng, lat }) => [lng, lat])).toEqual([[-117, 46], [-116, 46], [-116, 47]]);
    const listener = jest.fn();
    window.addEventListener('polygon-tool-save', listener);
    const centroid = { lng: -116.5, lat: 46.5 };
    act(() => editor.onSave([editor.initialVertices], centroid, { fillColor: '#123456' }, [{ fillOpacity: 0.5 }]));
    expect(listener.mock.calls[0][0].detail).toEqual(expect.objectContaining({
        centroid, fillColor: '#123456', vertices: expect.arrayContaining([expect.objectContaining({ ring: 0, fillOpacity: 0.5 })]),
    }));
    expect(screen.queryByRole('dialog')).toBeNull();
    window.removeEventListener('polygon-tool-save', listener);
});

test('requires login before saving a basin', () => {
    saveCustomLayer.mockClear();
    renderBasinPanel({ isLoggedIn: false, userEmail: '' });
    chooseSaveOption('Save as custom layer');
    expect(screen.getByRole('alert').textContent).toContain('log in');
    expect(saveCustomLayer).not.toHaveBeenCalled();
    chooseSaveOption('Save as polygon');
    expect(screen.queryByRole('dialog')).toBeNull();
});

test('cancelling polygon editing leaves the basin available and does not create a card', () => {
    renderBasinPanel();
    const listener = jest.fn();
    window.addEventListener('polygon-tool-save', listener);
    chooseSaveOption('Save as polygon');
    act(() => PolygonDrawingModal.mock.calls.at(-1)[0].onCancel());
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save watershed' }));
    expect(screen.getByRole('menuitem', { name: 'Save as polygon' }).disabled).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('polygon-tool-save', listener);
});

test.each([
    ['WA', 'wa', '152'],
    ['ID', 'id', '46'],
    ['OR', 'or', '119'],
])('requests %s river tiles from the current state-specific service', (state, service, layer) => {
    const map = createMap();
    render(<WatershedPanel isOpen mapInstance={map} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: state } });
    fireEvent.click(screen.getByRole('checkbox'));
    const url = new URL(map.getSource(`streamstats-rivers-${state}`).tiles[0]);
    expect(url.origin).toBe('https://gis.streamstats.usgs.gov');
    expect(url.pathname).toBe(`/arcgis/rest/services/stateServices/${service}/MapServer/export`);
    expect(url.searchParams.get('layers')).toBe(`show:${layer}`);
    expect(url.searchParams.get('bbox')).toBe('{bbox-epsg-3857}');
    expect(url.searchParams.get('format')).toBe('png32');
    expect(url.searchParams.get('transparent')).toBe('true');
});

test('preserves rivers when clearing a basin, closing the panel and changing basemaps', () => {
    const map = createMap();
    map.addSource('streamstats-basin', { type: 'geojson' });
    const { rerender } = render(<WatershedPanel isOpen mapInstance={map} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Clear result/ }));
    expect(map.getSource('streamstats-basin')).toBeUndefined();
    expect(map.getLayer('streamstats-rivers-WA').layout.visibility).toBe('visible');
    rerender(<WatershedPanel isOpen={false} mapInstance={map} />);
    map.resetStyle();
    act(() => map.emit('style.load'));
    expect(map.getLayer('streamstats-rivers-WA').layout.visibility).toBe('visible');
    rerender(<WatershedPanel isOpen mapInstance={map} />);
    expect(screen.getByRole('checkbox').checked).toBe(true);
});

test('waits for map style readiness and reports river source errors separately', () => {
    const map = createMap();
    map.isStyleLoaded.mockReturnValue(false);
    render(<WatershedPanel isOpen mapInstance={map} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(map.addSource).not.toHaveBeenCalled();
    act(() => map.emit('style.load'));
    expect(map.getLayer('streamstats-rivers-WA')).toBeDefined();
    act(() => map.emit('error', { sourceId: 'another-source' }));
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => map.emit('error', { sourceId: 'streamstats-rivers-WA' }));
    expect(screen.getByRole('alert').textContent).toContain('could not load');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByRole('alert')).toBeNull();
});


function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function basinResponse(pointCoordinates = [-117.22222, 46.33333]) {
    const entries = [{ name: 'globalwatershed', feature: sampleBasin }];
    if (pointCoordinates) {
        entries.push({ name: 'globalwatershedpoint', feature: {
            type: 'Feature', properties: {},
            geometry: { type: 'Point', coordinates: pointCoordinates },
        } });
    }
    return { ok: true, json: async () => ({
        bcrequest: { wsresp: { featurecollection: [entries], workspace_id: 'fixture-workspace' } },
    }) };
}

function selectPoint(map, coordinates = { lng: -117.123456, lat: 46.654321 }) {
    fireEvent.click(screen.getByRole('button', { name: 'Select point on map' }));
    act(() => map.emit('click', { lngLat: coordinates }));
    return coordinates;
}

async function resolveDelineation(request, response = basinResponse()) {
    await act(async () => {
        request.resolve(response);
        await request.promise;
    });
}

test('Save opens an accessible menu with keyboard navigation and closes on Escape or outside click', () => {
    saveCustomLayer.mockClear();
    renderBasinPanel();
    const trigger = screen.getByRole('button', { name: 'Save watershed' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Save watershed' })).toBeInTheDocument();
    const layer = screen.getByRole('menuitem', { name: 'Save as custom layer' });
    const polygon = screen.getByRole('menuitem', { name: 'Save as polygon' });
    layer.focus();
    fireEvent.keyDown(layer, { key: 'ArrowDown' });
    expect(polygon).toHaveFocus();
    fireEvent.keyDown(polygon, { key: 'ArrowUp' });
    expect(layer).toHaveFocus();
    fireEvent.keyDown(layer, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(saveCustomLayer).not.toHaveBeenCalled();
});

test('shows the clicked point and popup immediately, then reuses the marker for the returned point', async () => {
    const request = deferred();
    global.fetch.mockReturnValue(request.promise);
    const map = createMap();
    const { container } = render(<WatershedPanel isOpen mapInstance={map} />);
    const clicked = selectPoint(map);
    const marker = mapboxgl.Marker.mock.results[0].value;
    const popup = mapboxgl.Popup.mock.results[0].value;

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(marker.setLngLat).toHaveBeenLastCalledWith([clicked.lng, clicked.lat]);
    expect(marker.getElement()).toHaveAttribute('role', 'button');
    expect(marker.getElement()).toHaveAccessibleName(/Pour point/i);
    expect(document.body).toContainElement(marker.getElement());
    expect(document.body).toContainElement(popup.element);
    expect(popup.content.textContent).toContain('46.65432');
    expect(popup.content.textContent).toContain('-117.12346');
    expect(container.querySelector('.watershed-panel')).not.toHaveTextContent('46.65432');
    expect(screen.queryByRole('button', { name: 'Save watershed' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear result from map' })).toBeEnabled();
    expect(map.getSource('streamstats-basin')).toBeUndefined();
    expect(map.fitBounds).not.toHaveBeenCalled();

    await resolveDelineation(request);
    expect(mapboxgl.Marker).toHaveBeenCalledTimes(1);
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-117.22222, 46.33333]);
    expect(popup.content.textContent).toContain('46.33333');
    expect(popup.content.textContent).toContain('-117.22222');
    expect(map.getSource('streamstats-basin').data).toEqual(sampleBasin);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save watershed' })).toBeEnabled();
    expect(container.querySelector('.watershed-panel')).not.toHaveTextContent('Pour point:');
});

test('closing the panel preserves the pending point across style changes without reopening a dismissed popup', async () => {
    const request = deferred();
    global.fetch.mockReturnValue(request.promise);
    const map = createMap();
    const { rerender } = render(<WatershedPanel isOpen mapInstance={map} />);
    selectPoint(map);
    const marker = mapboxgl.Marker.mock.results[0].value;
    const popup = mapboxgl.Popup.mock.results[0].value;
    popup.remove();

    rerender(<WatershedPanel isOpen={false} mapInstance={map} />);
    map.resetStyle();
    act(() => map.emit('style.load'));
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);
    expect(marker.remove).not.toHaveBeenCalled();
    expect(document.body).toContainElement(marker.getElement());

    await resolveDelineation(request);
    expect(map.getSource('streamstats-basin')).toBeDefined();
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-117.22222, 46.33333]);
    expect(mapboxgl.Marker).toHaveBeenCalledTimes(1);
    expect(popup.addTo).toHaveBeenCalledTimes(1);
    expect(document.body).not.toContainElement(popup.element);
    rerender(<WatershedPanel isOpen mapInstance={map} />);
    expect(screen.getByRole('button', { name: 'Save watershed' })).toBeEnabled();
});

test.each(['cancel', 'clear', 'unmount'])('%s invalidates a pending response so it cannot draw a late basin', async action => {
    const request = deferred();
    global.fetch.mockReturnValue(request.promise);
    const map = createMap();
    const { unmount } = render(<WatershedPanel isOpen mapInstance={map} />);
    selectPoint(map);
    const marker = mapboxgl.Marker.mock.results[0].value;
    const popup = mapboxgl.Popup.mock.results[0].value;

    if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    else if (action === 'clear') fireEvent.click(screen.getByRole('button', { name: 'Clear result from map' }));
    else unmount();
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    if (action === 'cancel') {
        expect(marker.remove).not.toHaveBeenCalled();
        expect(document.body).toContainElement(marker.getElement());
    } else {
        expect(marker.remove).toHaveBeenCalled();
        expect(popup.remove).toHaveBeenCalled();
        expect(document.body).not.toContainElement(marker.getElement());
        expect(document.body).not.toContainElement(popup.element);
    }

    // The mock deliberately ignores abort, as a late service response can still settle.
    await resolveDelineation(request);
    expect(map.getSource('streamstats-basin')).toBeUndefined();
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(mapboxgl.Marker).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Save watershed' })).not.toBeInTheDocument();
});

test('a failed request keeps its point and a retry without a returned point keeps the new clicked position', async () => {
    const retry = deferred();
    global.fetch.mockRejectedValueOnce(new Error('StreamStats offline')).mockReturnValueOnce(retry.promise);
    const map = createMap();
    render(<WatershedPanel isOpen mapInstance={map} />);
    selectPoint(map);
    await waitFor(() => expect(screen.getByText('StreamStats offline')).toBeInTheDocument());
    expect(document.querySelectorAll('.watershed-point-marker')).toHaveLength(1);
    expect(map.fitBounds).not.toHaveBeenCalled();

    const clicked = selectPoint(map, { lng: -116.123456, lat: 47.654321 });
    expect(document.querySelectorAll('.watershed-point-marker')).toHaveLength(1);
    await resolveDelineation(retry, basinResponse(null));
    const marker = mapboxgl.Marker.mock.results.at(-1).value;
    expect(marker.setLngLat).toHaveBeenLastCalledWith([clicked.lng, clicked.lat]);
    expect(map.getSource('streamstats-basin')).toBeDefined();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
});

test('closing an armed panel removes its map click listener and restores the cursor', () => {
    const map = createMap();
    const { rerender } = render(<WatershedPanel isOpen mapInstance={map} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select point on map' }));
    expect(map.getCanvas().style.cursor).toBe('crosshair');
    rerender(<WatershedPanel isOpen={false} mapInstance={map} />);
    expect(map.getCanvas().style.cursor).toBe('');
    act(() => map.emit('click', { lngLat: { lng: -117, lat: 46 } }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mapboxgl.Marker).not.toHaveBeenCalled();
});


test('a cancelled request settling during its replacement cannot clear the new loading state or move its point', async () => {
    const first = deferred();
    const second = deferred();
    global.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const map = createMap();
    render(<WatershedPanel isOpen mapInstance={map} />);
    selectPoint(map);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    const clicked = selectPoint(map, { lng: -116.456789, lat: 47.123456 });
    const marker = mapboxgl.Marker.mock.results.at(-1).value;
    const secondSignal = global.fetch.mock.calls[1][1].signal;

    await resolveDelineation(first, basinResponse([-117.9, 46.9]));
    expect(secondSignal.aborted).toBe(false);
    expect(screen.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Select point on map' })).toBeDisabled();
    expect(marker.setLngLat).toHaveBeenLastCalledWith([clicked.lng, clicked.lat]);
    expect(map.getSource('streamstats-basin')).toBeUndefined();
    expect(map.fitBounds).not.toHaveBeenCalled();

    await resolveDelineation(second, basinResponse([-116.4, 47.2]));
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-116.4, 47.2]);
    expect(map.getSource('streamstats-basin')).toBeDefined();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save watershed' })).toBeEnabled();
});
