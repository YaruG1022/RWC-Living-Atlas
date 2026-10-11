import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BasemapSwitcher from './BasemapSwitcher';

jest.mock('./OnboardingBasemapPanel', () => () => null);
jest.mock('mapbox-gl', () => ({ accessToken: '' }));

function setupMap() {
    let style = {
        sources: { composite: {}, 'user-rivers': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
        layers: [{ id: 'roads', source: 'composite' }, { id: 'rivers', source: 'user-rivers', type: 'line' }],
    };
    const map = {
        getCenter: () => ({ lng: -120, lat: 46 }), getZoom: () => 5.5,
        getBearing: () => 12, getPitch: () => 20,
        getStyle: () => style,
        setStyle: jest.fn(next => { style = typeof next === 'string' ? { sources: {}, layers: [] } : JSON.parse(JSON.stringify(next)); }),
        once: jest.fn((event, callback) => callback()),
        setCenter: jest.fn(), setZoom: jest.fn(), setBearing: jest.fn(), setPitch: jest.fn(),
        getSource: id => style.sources[id], getLayer: id => style.layers.find(layer => layer.id === id),
        addSource: jest.fn((id, source) => { style.sources[id] = source; }),
        addLayer: jest.fn(layer => { style.layers.push(layer); }),
    };
    return map;
}

function ControlledSwitcher({ map, onChange }) {
    const [selected, setSelected] = React.useState('streets-v12');
    return <BasemapSwitcher isOpen mapInstance={map} currentBasemapId={selected} onBasemapChange={id => {
        setSelected(id);
        onChange?.(id);
    }} />;
}

test('adds four public styles with HTTPS tiles, attribution and native zoom limits', () => {
    const map = setupMap();
    const onBasemapChange = jest.fn();
    const { container } = render(<ControlledSwitcher map={map} onChange={onBasemapChange} />);
    expect(container.querySelectorAll('[data-basemap-id]')).toHaveLength(12);
    ['openstreetmap', 'usgs-topo', 'usgs-imagery', 'usgs-relief'].forEach(id => {
        const row = container.querySelector(`[data-basemap-id="${id}"]`);
        expect(row.querySelector('a').href).toMatch(/^https:\/\//);
        expect(row.querySelector('img').src).not.toContain('access_token');
        expect(row.querySelector('img').src).not.toMatch(/\{[zxy]\}/);
        fireEvent.click(row);
        const source = map.setStyle.mock.calls.at(-1)[0].sources[id];
        expect(source.tiles[0]).toMatch(/^https:\/\//);
        expect(source.attribution).toContain('<a href=');
        expect(source.maxzoom).toBe(id === 'openstreetmap' ? 19 : id === 'usgs-relief' ? 7 : 16);
        expect(onBasemapChange).toHaveBeenLastCalledWith(id);
    });
});

test('switching raster and Mapbox styles retains user overlays without restoring old basemaps', () => {
    const map = setupMap();
    const { container } = render(<ControlledSwitcher map={map} />);
    ['openstreetmap', 'usgs-topo', 'streets-v12'].forEach(id => {
        fireEvent.click(container.querySelector(`[data-basemap-id="${id}"]`));
        const style = map.getStyle();
        expect(Object.keys(style.sources).sort()).toEqual(id === 'streets-v12' ? ['user-rivers'] : [id, 'user-rivers'].sort());
        expect(style.layers.filter(layer => layer.id === 'rivers')).toHaveLength(1);
        expect(map.setCenter).toHaveBeenLastCalledWith({ lng: -120, lat: 46 });
        expect(map.setZoom).toHaveBeenLastCalledWith(5.5);
        expect(map.setBearing).toHaveBeenLastCalledWith(12);
        expect(map.setPitch).toHaveBeenLastCalledWith(20);
    });
});

test('search finds free USGS styles and clearing restores the full list', () => {
    const { container } = render(<BasemapSwitcher isOpen mapInstance={setupMap()} />);
    fireEvent.change(screen.getByPlaceholderText('Search map style'), { target: { value: 'USGS' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search map style'), { key: 'Enter' });
    expect(container.querySelectorAll('[data-basemap-id]')).toHaveLength(3);
    fireEvent.click(screen.getByTitle('Clear Search'));
    expect(container.querySelectorAll('[data-basemap-id]')).toHaveLength(12);
});

test('a controlled preference change selects the new raster style', () => {
    const map = setupMap();
    const { rerender } = render(<BasemapSwitcher isOpen mapInstance={map} currentBasemapId="streets-v12" />);
    rerender(<BasemapSwitcher isOpen mapInstance={map} currentBasemapId="usgs-relief" />);
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(map.setStyle.mock.calls[0][0].sources['usgs-relief']).toBeDefined();
});

test('thumbnail attribution links do not select a different map', () => {
    const map = setupMap();
    const { container } = render(<ControlledSwitcher map={map} />);
    fireEvent.click(container.querySelector('[data-basemap-id="openstreetmap"] a'));
    expect(map.setStyle).not.toHaveBeenCalled();
});
