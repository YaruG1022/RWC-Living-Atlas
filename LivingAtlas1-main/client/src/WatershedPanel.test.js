import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import WatershedPanel from './WatershedPanel';

function createMap() {
    const sources = {};
    const layers = {};
    const listeners = {};
    return {
        getSource: id => sources[id],
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
