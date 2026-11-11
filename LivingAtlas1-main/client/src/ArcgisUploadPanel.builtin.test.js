import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ArcgisUploadPanel from './ArcgisUploadPanel';
import { fetchServicesByStateMap, fetchVisibleArcgisLayerTargets } from './arcgisServicesDb';
import { fetchArcgisLayers } from './arcgisDataUtils';
import { BUILTIN_STATUS_EVENT } from './builtinLayers';
import { retryBuiltinLayer } from './builtinLayerController';

jest.mock('./arcgisServicesDb', () => ({ fetchServicesByStateMap: jest.fn(), fetchVisibleArcgisLayerTargets: jest.fn(async () => []) }));
jest.mock('./builtinLayerController', () => ({ getBuiltinLayerStatuses: () => ({}), setBuiltinLayerOpacity: () => {}, retryBuiltinLayer: jest.fn() }));
jest.mock('./arcgisVectorUtils', () => ({}));
jest.mock('./arcgisPopupUtils', () => ({}));
jest.mock('./arcgisDataUtils', () => ({ fetchArcgisLayers: jest.fn() }));
jest.mock('./arcgisUpdateServices', () => ({}));
jest.mock('./ArcgisInfoModals', () => ({ ServiceInfoModal: () => null, LayerInfoModal: () => null }));
jest.mock('./OnboardingArcgisUploadPanel', () => () => null);

const noMap = () => null;

function Panel() {
    const [visibility, setVisibility] = React.useState({});
    return <ArcgisUploadPanel isOpen mapInstance={noMap} areaVisibility={visibility} handleAreaCheckbox={id => setVisibility(previous => ({ ...previous, [id]: !previous[id] }))} />;
}

beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    window.atlasMapInstance = undefined;
    Element.prototype.scrollIntoView = jest.fn();
    fetchVisibleArcgisLayerTargets.mockResolvedValue([]);
    fetchArcgisLayers.mockResolvedValue([]);
    fetchServicesByStateMap.mockReset().mockResolvedValue({ WA: [], OR: [], ID: [] });
    retryBuiltinLayer.mockReset();
});

afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

async function openFolder() {
    render(<Panel />);
    fireEvent.click(await screen.findByText('Built-in Layers'));
    await screen.findByRole('checkbox', { name: 'National Forests' });
}

test('provides three usable new categories with descriptions and an added-only filter', async () => {
    await openFolder();
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    fireEvent.click(screen.getByRole('checkbox', { name: 'National Forests' }));
    expect(screen.getByRole('checkbox', { name: 'National Forests' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Show only services added to the map' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'About National Forests' }));
    await screen.findByRole('dialog', { name: 'National Forests' });
    expect(screen.getByText(/not tree cover/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close layer information' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uncheck all layers on map' }));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Uncheck all layers on map' })).toBeDisabled();
});

test('all six built-ins provide a color legend and source details without the site badge', async () => {
    await openFolder();
    expect(screen.queryByText('Included with site')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^About / })).toHaveLength(6);
    expect(screen.queryByText('About this layer')).not.toBeInTheDocument();
    for (const [label, source] of [
        ['Hydrological Boundaries', 'USGS · Watershed Boundary Dataset'],
        ['City Limits', 'U.S. Census Bureau · TIGERweb'],
    ]) {
        const row = screen.getByRole('checkbox', { name: label }).closest('.builtin-layer-row');
        expect(row.querySelector('.builtin-layer-swatch')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: `About ${label}` }));
        await screen.findByRole('dialog', { name: label });
        expect(screen.getByRole('link', { name: source })).toHaveAttribute('href', expect.stringMatching(/^https:\/\//));
        fireEvent.click(screen.getByRole('button', { name: 'Close layer information' }));
        fireEvent.click(screen.getByRole('checkbox', { name: label }));
        expect(screen.getByRole('checkbox', { name: label })).toBeChecked();
    }
});

test('built-in search expands results and includes them in the navigation count', async () => {
    await openFolder();
    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: 'forest' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByRole('checkbox', { name: 'National Forests' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Major Roads' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument());
});

test('Rivers is independently selectable from Hydrological Boundaries and searchable', async () => {
    await openFolder();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rivers', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Rivers', exact: true })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Hydrological Boundaries' })).not.toBeChecked();
    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: 'rivers' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Rivers', exact: true })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Hydrological Boundaries' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Uncheck all layers on map' }));
    expect(screen.getByRole('checkbox', { name: 'Rivers', exact: true })).not.toBeChecked();
});

test('loading errors remain actionable and retry uses the current map', async () => {
    await openFolder();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lakes & Reservoirs' }));
    act(() => window.dispatchEvent(new CustomEvent(BUILTIN_STATUS_EVENT, { detail: { id: 'Lake', state: 'error', message: 'Unable to load Lakes & Reservoirs. Please retry.' } })));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load');
    fireEvent.click(screen.getByRole('button', { name: 'Retry Lakes & Reservoirs' }));
    expect(retryBuiltinLayer).toHaveBeenCalledWith(undefined, 'Lake');
});


test('searching inside Built-in Layers does not query or count external ArcGIS services', async () => {
    fetchServicesByStateMap.mockResolvedValue({ WA: [{ key: 'external-forest', label: 'Forest Inventory', folder: 'Root', type: 'MapServer', url: 'https://example.invalid/MapServer' }], OR: [], ID: [] });
    render(<Panel />);
    await screen.findByText('Washington State ArcGIS Services');
    fireEvent.click(screen.getByText('Built-in Layers'));
    const search = screen.getByRole('textbox');
    expect(search).toHaveAttribute('placeholder', 'Search Built-in Layers…');
    fireEvent.change(search, { target: { value: 'forest' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByText('1 / 1')).toBeInTheDocument();
    expect(screen.queryByText('Forest Inventory')).not.toBeInTheDocument();
    expect(fetchArcgisLayers).not.toHaveBeenCalled();
});
