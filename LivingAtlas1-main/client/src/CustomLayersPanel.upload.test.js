import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomLayersPanel from './CustomLayersPanel';
import { fetchCustomFolders, fetchCustomLayers, fetchVisibleCustomLayerServiceKeys, saveCustomLayer } from './arcgisServicesDb';
import { readCustomLayerFile } from './customLayerUpload';
import { addUploadedVectorLayer, uploadedSourceId } from './uploadedVectorUtils';

jest.mock('./api', () => ({}));
jest.mock('./arcgisServicesDb', () => ({ fetchCustomLayers: jest.fn(), fetchCustomFolders: jest.fn(), fetchVisibleCustomLayerServiceKeys: jest.fn(), saveCustomLayer: jest.fn() }));
jest.mock('./customLayerUpload', () => ({ ...jest.requireActual('./customLayerUpload'), readCustomLayerFile: jest.fn() }));
jest.mock('./arcgisVectorUtils', () => ({}));
jest.mock('./uploadedVectorUtils', () => ({ addUploadedVectorLayer: jest.fn(), removeUploadedVectorLayer: jest.fn(), uploadedSourceId: key => `uploaded-source-${key}` }));
jest.mock('./arcgisPopupUtils', () => ({}));
jest.mock('./arcgisDataUtils', () => ({}));
jest.mock('./ArcgisInfoModals', () => ({ ServiceInfoModal: () => null, LayerInfoModal: () => null }));
jest.mock('./OnboardingCustomLayersPanel', () => () => null);
const polygon = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-123, 47], [-122, 47], [-122, 48], [-123, 47]]] }, properties: { AIR_REGION: 'Synthetic region' } }] };
let map;

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('email', 'gis-test@example.invalid');
    fetchCustomLayers.mockResolvedValue([]);
    fetchCustomFolders.mockResolvedValue([]);
    fetchVisibleCustomLayerServiceKeys.mockResolvedValue([]);
    saveCustomLayer.mockResolvedValue({ success: true });
    const sources = {};
    map = { getSource: key => sources[key], fitBounds: jest.fn(), isStyleLoaded: () => true, off: jest.fn() };
    addUploadedVectorLayer.mockImplementation((_, service) => { sources[uploadedSourceId(service.key)] = {}; });
    readCustomLayerFile.mockResolvedValue({ layers: [{ name: 'Air_Areas', geojson: polygon }], warnings: [] });
});

async function openMenu() {
    render(<CustomLayersPanel isOpen mapInstance={() => map} />);
    const button = screen.getByRole('button', { name: 'Upload data' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    return button;
}

function selectZip() {
    fireEvent.click(screen.getByRole('menuitem', { name: /GIS data \(\.zip\)/ }));
    fireEvent.change(screen.getByLabelText('Upload GIS data (.zip)'), { target: { files: [new File(['zip'], 'air-areas.zip')] } });
}

test('chooses the GIS picker, persists attributes and immediately displays the imported layer', async () => {
    await openMenu();
    selectZip();
    await waitFor(() => expect(saveCustomLayer).toHaveBeenCalledTimes(1));
    expect(readCustomLayerFile).toHaveBeenCalledWith(expect.any(File), 'gis');
    expect(saveCustomLayer).toHaveBeenCalledWith('gis-test@example.invalid', expect.objectContaining({ label: 'air-areas', type: 'uploaded', folder: 'Root', geojson: polygon }));
    await waitFor(() => expect(addUploadedVectorLayer).toHaveBeenCalledTimes(1));
    expect(map.fitBounds).toHaveBeenCalledWith([[-123, 47], [-122, 48]], expect.anything());
    expect(screen.getByRole('status')).toHaveTextContent('Uploaded 1 layer');
});

test('imports multiple feature classes as separate layers, keeping a partial save visible on failure', async () => {
    readCustomLayerFile.mockResolvedValue({ layers: [{ name: 'Areas', geojson: polygon }, { name: 'Points', geojson: polygon }], warnings: [] });
    saveCustomLayer.mockResolvedValueOnce({ success: true }).mockRejectedValueOnce(new Error('Library unavailable'));
    await openMenu(); selectZip();
    expect(await screen.findByRole('alert')).toHaveTextContent('1 layer(s) were saved');
    expect(saveCustomLayer.mock.calls[0][1].label).toBe('air-areas — Areas');
    await waitFor(() => expect(addUploadedVectorLayer).toHaveBeenCalledTimes(1));
});

test('reports conversion errors without saving or displaying an empty layer', async () => {
    readCustomLayerFile.mockRejectedValue({ response: { data: { detail: 'The GIS ZIP contains no displayable spatial features.' } } });
    await openMenu(); selectZip();
    expect(await screen.findByRole('alert')).toHaveTextContent('no displayable spatial features');
    expect(saveCustomLayer).not.toHaveBeenCalled();
    expect(addUploadedVectorLayer).not.toHaveBeenCalled();
});

test('blocks duplicate uploads until the current import finishes', async () => {
    let finish;
    readCustomLayerFile.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const button = await openMenu(); selectZip();
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Upload GIS data (.zip)'), { target: { files: [new File(['zip'], 'duplicate.zip')] } });
    expect(readCustomLayerFile).toHaveBeenCalledTimes(1);
    await act(async () => finish({ layers: [{ name: 'Area', geojson: polygon }], warnings: [] }));
    await waitFor(() => expect(button).not.toBeDisabled());
});
