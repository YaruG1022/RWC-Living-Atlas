import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Card from './Card';
import api from './api';
import { fetchAllArcgisServices } from './arcgisServicesDb';
import { fetchUserPreferences } from './userPreferencesApi';

jest.mock('./api', () => ({ defaults: { baseURL: '' }, get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('./arcgisDataUtils', () => ({ fetchArcgisLegend: jest.fn() }));
jest.mock('./userPreferencesApi', () => ({ fetchUserPreferences: jest.fn().mockResolvedValue({}) }));
jest.mock('./arcgisServicesDb', () => ({ fetchAllArcgisServices: jest.fn().mockResolvedValue([]) }));
jest.mock('./RichTextEditor', () => () => null);
jest.mock('./PolygonDrawingModal', () => () => null);
jest.mock('./CoordinatesPanel', () => () => null);
jest.mock('./ArcGISPickerModal', () => () => null);
jest.mock('./CustomLayerPickerModal', () => () => null);
jest.mock('./OnboardingLearnMore', () => ({ __esModule: true, default: () => null, LEARN_MORE_EDIT_MODE_STEP: 0 }));
jest.mock('react-modal', () => ({ __esModule: true, default: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null }));

const originalImages = Array.from({ length: 3 }, (_, index) => ({ imageID: index + 1, url: `/fixture-${index + 1}.jpg`, alt: `Fixture ${index + 1}` }));
let savedCard;
beforeEach(() => {
    jest.clearAllMocks();
    fetchAllArcgisServices.mockResolvedValue([]);
    fetchUserPreferences.mockResolvedValue({});
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    localStorage.setItem('email', 'fixture@example.invalid');
    savedCard = { cardID: 101, title: 'Gallery fixture', username: 'fixture', email: 'fixture@example.invalid', name: 'Fixture', category: 'River', latitude: 46, longitude: -117, images: originalImages, gallery_layout: 'grid-3' };
    api.get.mockImplementation(url => Promise.resolve({ data: url.startsWith('/cardImages/')
        ? { images: savedCard.images, galleryLayout: savedCard.gallery_layout }
        : url.startsWith('/allCards') ? { data: [savedCard] } : { data: [] } }));
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });
});

async function editCard() {
    const { container } = render(<Card formData={savedCard} isLoggedIn onCardUpdate={() => {}} />);
    fireEvent.click(container.querySelector('.card'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open image 1' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    await waitFor(() => expect(screen.getByLabelText('Image layout').value).toBe('grid-3'));
    return screen.getByRole('region', { name: 'Card image gallery' });
}

test('cancel restores layout, image order and staged deletion without database writes', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'grid-6' } });
    fireEvent.click(within(gallery).getByRole('button', { name: 'Move image 2 earlier' }));
    fireEvent.click(within(gallery).getByRole('button', { name: 'Delete image 3' }));
    expect(within(gallery).getAllByRole('img')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('Image layout')).toBeNull());
    expect(within(gallery).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(originalImages.map(image => image.url));
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
});

test('save sends layout and reordered IDs and view mode retains the saved layout', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'grid-6' } });
    fireEvent.click(within(gallery).getByRole('button', { name: 'Move image 2 earlier' }));
    api.post.mockImplementation((url, body) => {
        if (url === '/uploadForm') savedCard = { ...savedCard, gallery_layout: body.get('gallery_layout') };
        return Promise.resolve({ data: {} });
    });
    api.put.mockImplementation((url, order) => {
        savedCard = { ...savedCard, images: order.map(id => originalImages.find(image => image.imageID === id)) };
        return Promise.resolve({ data: {} });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByLabelText('Image layout')).toBeNull());
    expect(api.post.mock.calls[0][1].get('gallery_layout')).toBe('grid-6');
    expect(api.put).toHaveBeenCalledWith('/reorderCardImages?cardID=101', [2, 1, 3]);
    expect(gallery.querySelector('.lm-gallery-layout-grid-6')).toBeTruthy();
    expect(within(gallery).getAllByRole('img')[0].getAttribute('src')).toBe(originalImages[1].url);
});

test('upload preserves draft layout and order; cancel removes only the new upload', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'grid-6' } });
    fireEvent.click(within(gallery).getByRole('button', { name: 'Move image 2 earlier' }));
    api.post.mockImplementation(() => {
        savedCard = { ...savedCard, images: [...originalImages, { imageID: 4, url: '/fixture-4.jpg' }] };
        return Promise.resolve({ data: { imageID: 4 } });
    });
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    fireEvent.change(input, { target: { files: [new File(['fixture'], 'fixture.png', { type: 'image/png' })] } });
    await waitFor(() => expect(within(gallery).getAllByRole('img')).toHaveLength(4));
    expect(screen.getByLabelText('Image layout').value).toBe('grid-6');
    expect(within(gallery).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(['/fixture-2.jpg', '/fixture-1.jpg', '/fixture-3.jpg', '/fixture-4.jpg']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/deleteCardImage/4'));
    expect(api.delete).toHaveBeenCalledTimes(1);
});

test('failed order save keeps the draft open and allows retry', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'grid-6' } });
    fireEvent.click(within(gallery).getByRole('button', { name: 'Move image 2 earlier' }));
    api.put.mockRejectedValueOnce(new Error('Fixture failure'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Image order could not be saved. Please try saving again.'));
    expect(screen.getByLabelText('Image layout').value).toBe('grid-6');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false));
    errors.mockRestore();
});

test('upload appends after the default cover, and the cover can be deleted and restored by cancel', async () => {
    const defaultCover = { imageID: 61, url: '/CEREO-logo.png', alt: 'Card cover' };
    savedCard = { ...savedCard, images: [defaultCover], thumbnail_link: defaultCover.url };
    const gallery = await editCard();
    api.post.mockImplementation(() => {
        savedCard = { ...savedCard, images: [defaultCover, { imageID: 62, url: '/new.png' }] };
        return Promise.resolve({ data: { imageID: 62 } });
    });
    fireEvent.change(document.querySelector('input[type="file"][accept="image/*"]'), { target: { files: [new File(['fixture'], 'new.png', { type: 'image/png' })] } });
    await waitFor(() => expect(within(gallery).getAllByRole('img')).toHaveLength(2));
    expect(within(gallery).getAllByRole('img')[0].getAttribute('src')).toBe('/CEREO-logo.png');
    fireEvent.click(within(gallery).getByRole('button', { name: 'Delete image 1' }));
    expect(within(gallery).getAllByRole('img')).toHaveLength(1);
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('Image layout')).toBeNull());
    expect(within(gallery).getByRole('img').getAttribute('src')).toBe('/CEREO-logo.png');
    expect(api.delete).toHaveBeenCalledWith('/deleteCardImage/62');
});

test('deleting and saving the last default cover keeps the gallery empty', async () => {
    savedCard = { ...savedCard, images: [{ imageID: 61, url: '/CEREO-logo.png' }], thumbnail_link: '/CEREO-logo.png' };
    const gallery = await editCard();
    fireEvent.click(within(gallery).getByRole('button', { name: 'Delete image 1' }));
    expect(within(gallery).queryByRole('img')).toBeNull();
    api.delete.mockImplementation(() => {
        savedCard = { ...savedCard, images: [], thumbnail_link: '' };
        return Promise.resolve({ data: {} });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByLabelText('Image layout')).toBeNull());
    expect(api.delete).toHaveBeenCalledWith('/deleteCardImage/61');
    expect(within(gallery).queryByRole('img')).toBeNull();
});
