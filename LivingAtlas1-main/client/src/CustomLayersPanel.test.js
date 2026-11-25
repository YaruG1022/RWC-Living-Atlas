import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomLayersPanel from './CustomLayersPanel';
import AppDialogHost from './AppDialogHost';
import { createCustomFolder, fetchCustomFolders, fetchCustomLayers, fetchVisibleCustomLayerServiceKeys } from './arcgisServicesDb';

jest.mock('./api', () => ({}));
jest.mock('./arcgisServicesDb', () => ({
    fetchCustomLayers: jest.fn(), fetchCustomFolders: jest.fn(), fetchVisibleCustomLayerServiceKeys: jest.fn(),
    createCustomFolder: jest.fn(),
}));
jest.mock('./arcgisVectorUtils', () => ({}));
jest.mock('./uploadedVectorUtils', () => ({}));
jest.mock('./arcgisPopupUtils', () => ({}));
jest.mock('./arcgisDataUtils', () => ({}));
jest.mock('./geoFileUtils', () => ({}));
jest.mock('./ArcgisInfoModals', () => ({ServiceInfoModal:()=>null,LayerInfoModal:()=>null}));
jest.mock('./OnboardingCustomLayersPanel', () => () => null);

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('email', 'probe@example.invalid');
    fetchCustomLayers.mockReset().mockResolvedValue([]);
    fetchCustomFolders.mockReset().mockResolvedValue([]);
    fetchVisibleCustomLayerServiceKeys.mockReset().mockResolvedValue([]);
    createCustomFolder.mockReset().mockResolvedValue({ sort_order: 0 });
});

test('New Folder uses the app dialog, validates names and writes only after confirmation', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    const nativePrompt = jest.spyOn(window, 'prompt');
    fetchCustomFolders.mockResolvedValue([{ folder_name: 'Existing', sort_order: 0 }]);
    try {
        render(<><CustomLayersPanel isOpen onClose={() => {}} /><AppDialogHost /></>);
        await screen.findByText('Existing');
        fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
        fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a folder name.');
        fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Existing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
        expect(screen.getByRole('alert')).toHaveTextContent('already exists');
        expect(createCustomFolder).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(createCustomFolder).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
        fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: '  Rivers  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
        await waitFor(() => expect(createCustomFolder).toHaveBeenCalledWith('probe@example.invalid', 'Rivers'));
        await screen.findByText('Rivers');
        expect(nativePrompt).not.toHaveBeenCalled();
    } finally {
        nativePrompt.mockRestore();
        delete HTMLDialogElement.prototype.showModal;
        delete HTMLDialogElement.prototype.close;
    }
});

test('New Folder creates a child of the open folder, even if its name exists elsewhere', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    fetchCustomFolders.mockResolvedValue([
        { folder_name: 'Hydrology', sort_order: 0 },
        { folder_name: 'Hydrology/Monitoring', sort_order: 1 },
        { folder_name: 'Rivers', sort_order: 2 },
    ]);
    try {
        render(<><CustomLayersPanel isOpen /><AppDialogHost /></>);
        fireEvent.click(await screen.findByText('Hydrology'));
        fireEvent.click(screen.getByText('Monitoring'));
        fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
        fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Other/Rivers' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
        expect(screen.getByRole('alert')).toHaveTextContent('cannot contain a slash');
        fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Rivers' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
        expect(await screen.findByText('Rivers')).toBeInTheDocument();
        expect(createCustomFolder).toHaveBeenCalledWith('probe@example.invalid', 'Hydrology/Monitoring/Rivers');
    } finally {
        delete HTMLDialogElement.prototype.showModal;
        delete HTMLDialogElement.prototype.close;
    }
});

test('a failed load shows a retry action rather than an empty library, and retry can recover', async () => {
    fetchCustomLayers.mockRejectedValueOnce(new Error('The layer library is temporarily unavailable. Please try again shortly.'));
    render(<CustomLayersPanel isOpen onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.queryByText(/No custom layers saved yet/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Retry'}));
    expect(await screen.findByText(/No custom layers saved yet/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(fetchCustomLayers).toHaveBeenCalledTimes(2);
});
