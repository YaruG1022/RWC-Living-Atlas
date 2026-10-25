import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomLayersPanel from './CustomLayersPanel';
import { fetchCustomFolders, fetchCustomLayers, fetchVisibleCustomLayerServiceKeys } from './arcgisServicesDb';

jest.mock('./api', () => ({}));
jest.mock('./arcgisServicesDb', () => ({
    fetchCustomLayers: jest.fn(), fetchCustomFolders: jest.fn(), fetchVisibleCustomLayerServiceKeys: jest.fn(),
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
