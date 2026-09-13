import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WatershedPanel from './WatershedPanel';
import { saveCustomLayer } from './arcgisServicesDb';
import PolygonDrawingModal from './PolygonDrawingModal';
import BasemapPanelOnboarding from './OnboardingBasemapPanel';

jest.mock('./arcgisServicesDb', () => ({ saveCustomLayer: jest.fn() }));
jest.mock('./PolygonDrawingModal', () => jest.fn(() => <div role="dialog">Edit Polygon</div>));

beforeEach(() => {
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

function createMap() {
    const sources = {};
    const layers = {};
    const listeners = {};
    return {
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
    fireEvent.click(screen.getByRole('button', { name: 'Save as custom layer' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Save as custom layer' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Save failed'));
    expect(refreshed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save as custom layer' }));
    await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
});

test('loads basin vertices into the editor then continues through the existing card event', () => {
    renderBasinPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Save as polygon' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Save as custom layer' }));
    expect(screen.getByRole('alert').textContent).toContain('log in');
    expect(saveCustomLayer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save as polygon' }));
    expect(screen.queryByRole('dialog')).toBeNull();
});

test('cancelling polygon editing leaves the basin available and does not create a card', () => {
    renderBasinPanel();
    const listener = jest.fn();
    window.addEventListener('polygon-tool-save', listener);
    fireEvent.click(screen.getByRole('button', { name: 'Save as polygon' }));
    act(() => PolygonDrawingModal.mock.calls.at(-1)[0].onCancel());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save as polygon' }).disabled).toBe(false);
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
