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
jest.mock('./PolygonDrawingModal', () => ({ mode, initialVertices, onCancel }) => <div data-testid="shape-editor" data-mode={mode} data-vertices={JSON.stringify(initialVertices)}><button onClick={onCancel}>Cancel shape editing</button></div>);
jest.mock('./CoordinatesPanel', () => ({ initialPoints, onCancel }) => <div data-testid="coordinate-editor" data-points={JSON.stringify(initialPoints)}><button onClick={onCancel}>Cancel coordinate editing</button></div>);
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
        ? { images: savedCard.images, galleryLayout: savedCard.gallery_layout, galleryImageIDs: savedCard.gallery_image_ids }
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
    await waitFor(() => expect(screen.getByLabelText('Image layout').value).toBe('multi'));
    return screen.getByRole('region', { name: 'Card image gallery' });
}

test('selected numbers and cover follow main-page dragging; all-images has no sorting arrows', async () => {
    await editCard();
    fireEvent.click(screen.getByRole('button', { name: 'See all 3 images' }));
    const label = index => screen.getByRole('checkbox', { name: `Show image ${index} on main page` }).closest('label');
    expect(within(label(1)).getByLabelText('Display order 1')).toBeTruthy();
    expect(label(1).title).toBe('Card cover');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show image 1 on main page' }));
    expect(within(label(2)).getByLabelText('Display order 2')).toBeTruthy();
    expect(label(2).title).not.toBe('Card cover');
    expect(label(1).querySelector('.learn-more-gallery-order').textContent).toBe('');
    expect(label(2).querySelector('input').nextElementSibling.getAttribute('aria-label')).toBe('Display order 2');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Learn More', exact: true }));
    const returnedGallery = screen.getByRole('region', { name: 'Card image gallery' });
    const dataTransfer = { setData: jest.fn() };
    fireEvent.dragStart(within(returnedGallery).getByRole('button', { name: 'Open image 2' }).parentElement, { dataTransfer });
    const target = within(returnedGallery).getByRole('button', { name: 'Open image 1' }).parentElement;
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(within(returnedGallery).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(['/fixture-3.jpg', '/fixture-2.jpg']);
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'slideshow' } });
    expect(within(returnedGallery).getByRole('img').getAttribute('src')).toBe('/fixture-3.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'See all 3 images' }));
    expect(within(label(2)).getByLabelText('Display order 1')).toBeTruthy();
    expect(label(2).title).toBe('Card cover');
    expect(within(label(3)).getByLabelText('Display order 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move image up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move image down' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Show image 1 on main page' }).disabled).toBe(true));
    expect(api.post.mock.calls[0][1].get('gallery_image_ids')).toBe('[3,2]');
});

test.each(['point', 'multipoint', 'polygon', 'image'])('map popup editing opens the existing %s tool and cancel returns to the card draft', async locationType => {
    window.atlasMapInstance = { flyTo: jest.fn(), fitBounds: jest.fn(), getLayer: jest.fn(() => false), setLayoutProperty: jest.fn() };
    const vertices = [{ lat: 46, lng: -117, icon: 'pin', markerColor: '#123456', markerOpacity: .7 }, { lat: 47, lng: -117 }, { lat: 47, lng: -116 }, { lat: 46, lng: -116 }];
    savedCard = { ...savedCard, location_type: locationType, polygon_vertices: vertices };
    render(<Card formData={savedCard} isLoggedIn forceOpenLearnMoreSignal={100} forceEditLocation />);
    const isShape = locationType === 'polygon' || locationType === 'image';
    const editor = await screen.findByTestId(isShape ? 'shape-editor' : 'coordinate-editor');
    if (isShape) {
        expect(editor.getAttribute('data-mode')).toBe(locationType);
        expect(JSON.parse(editor.getAttribute('data-vertices'))).toEqual(vertices);
    } else {
        const points = JSON.parse(editor.getAttribute('data-points'));
        expect(points).toHaveLength(locationType === 'multipoint' ? 4 : 1);
        if (locationType === 'multipoint') expect(points[0]).toMatchObject({ color: '#123456', opacity: .7, icon: 'pin' });
    }
    fireEvent.click(screen.getByRole('button', { name: isShape ? 'Cancel shape editing' : 'Cancel coordinate editing' }));
    expect(await screen.findByRole('button', { name: 'Save', exact: true })).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    delete window.atlasMapInstance;
});

test('map popup editing preserves owner permissions', () => {
    localStorage.setItem('email', 'other@example.invalid');
    localStorage.setItem('isAdmin', 'false');
    render(<Card formData={savedCard} isLoggedIn forceOpenLearnMoreSignal={101} forceEditLocation />);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("don't have permission"));
    expect(screen.queryByTestId('coordinate-editor')).toBeNull();
    expect(screen.queryByTestId('shape-editor')).toBeNull();
});

test.each([8, 29, 30])('all-images upload availability at %i images respects the 30-image cap', async count => {
    savedCard.images = Array.from({ length: count }, (_, index) => ({ imageID: index + 1, url: `/limit-${index + 1}.jpg` }));
    await editCard();
    fireEvent.click(screen.getByRole('button', { name: `See all ${count} images` }));
    expect(screen.getByRole('button', { name: 'Add New Image' }).disabled).toBe(count === 30);
    expect(screen.getAllByRole('checkbox', { name: /on main page/ })).toHaveLength(count);
    expect(screen.getAllByRole('checkbox', { name: /on main page/ }).filter(input => input.checked)).toHaveLength(6);
});

test('clearing number five preserves six and assigns five to the next selected image', async () => {
    savedCard.images = Array.from({ length: 7 }, (_, index) => ({ imageID: index + 1, url: `/vacancy-${index + 1}.jpg` }));
    await editCard();
    fireEvent.click(screen.getByRole('button', { name: 'See all 7 images' }));
    const back = screen.getByRole('button', { name: 'Back to Learn More', exact: true });
    expect(back.querySelector('svg[data-icon="arrow-left"]')).toBeTruthy();
    expect(back.parentElement.contains(screen.getByRole('button', { name: 'Add New Image' }))).toBe(true);
    expect(back.parentElement.contains(screen.getByRole('button', { name: 'Delete Selected (0)' }))).toBe(true);
    const label = index => screen.getByRole('checkbox', { name: `Show image ${index} on main page` }).closest('label');
    expect(label(5).textContent).toBe('5');
    expect(label(5).closest('.learn-more-all-image-item').classList.contains('is-main-selected')).toBe(true);
    const bulkSelect = within(label(5).closest('.learn-more-all-image-item')).getByRole('button', { name: 'Select image' });
    expect(bulkSelect.querySelector('svg[data-icon="check"]')).toBeTruthy();
    fireEvent.click(bulkSelect);
    expect(bulkSelect.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Delete Selected (1)' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show image 5 on main page' }));
    expect(within(label(6)).getByLabelText('Display order 6')).toBeTruthy();
    expect(label(5).querySelector('.learn-more-gallery-order').textContent).toBe('');
    expect(label(5).closest('.learn-more-all-image-item').classList.contains('is-main-selected')).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show image 7 on main page' }));
    expect(within(label(7)).getByLabelText('Display order 5')).toBeTruthy();
    expect(within(label(6)).getByLabelText('Display order 6')).toBeTruthy();
    fireEvent.click(back);
    expect(within(screen.getByRole('region', { name: 'Card image gallery' })).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual([1,2,3,4,7,6].map(id => `/vacancy-${id}.jpg`));
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(screen.queryByLabelText('Image layout')).toBeNull());
    expect(api.post.mock.calls[0][1].get('gallery_image_ids')).toBe('[1,2,3,4,7,6]');
});

test('main-page selection caps at six and applies to both modes; cancel restores selection', async () => {
    savedCard.images = Array.from({ length: 8 }, (_, index) => ({ imageID: index + 1, url: `/selection-${index + 1}.jpg` }));
    const gallery = await editCard();
    fireEvent.click(screen.getByRole('button', { name: 'See all 8 images' }));
    expect(screen.getAllByRole('checkbox', { name: /on main page/ })).toHaveLength(8);
    expect(screen.getByRole('checkbox', { name: 'Show image 7 on main page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show image 1 on main page' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show image 7 on main page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Learn More', exact: true }));
    const mainGallery = screen.getByRole('region', { name: 'Card image gallery' });
    expect(within(mainGallery).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual([7,2,3,4,5,6].map(id => `/selection-${id}.jpg`));
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'slideshow' } });
    expect(within(mainGallery).getAllByRole('button', { name: /^Show gallery image/ })).toHaveLength(6);
    fireEvent.click(within(mainGallery).getByRole('button', { name: 'Show gallery image 6' }));
    expect(within(mainGallery).getByRole('img').getAttribute('src')).toBe('/selection-6.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(screen.queryByLabelText('Image layout')).toBeNull());
    expect(within(screen.getByRole('region', { name: 'Card image gallery' })).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual([1,2,3,4,5,6].map(id => `/selection-${id}.jpg`));
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
});

test('selection saves as JSON and remains visible after refreshing the saved card', async () => {
    await editCard();
    fireEvent.click(screen.getByRole('button', { name: 'See all 3 images' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show image 1 on main page' }));
    api.post.mockImplementation((url, fields) => {
        savedCard = { ...savedCard, gallery_image_ids: JSON.parse(fields.get('gallery_image_ids')) };
        return Promise.resolve({ data: {} });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Show image 1 on main page' }).disabled).toBe(true));
    expect(api.post.mock.calls[0][1].get('gallery_image_ids')).toBe('[2,3]');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Learn More', exact: true }));
    expect(within(screen.getByRole('region', { name: 'Card image gallery' })).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(['/fixture-2.jpg','/fixture-3.jpg']);
});

test('cancel restores layout, image order and staged deletion without database writes', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'multi' } });
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
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'multi' } });
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
    expect(api.post.mock.calls[0][1].get('gallery_layout')).toBe('multi');
    expect(api.put).toHaveBeenCalledWith('/reorderCardImages?cardID=101', [2, 1, 3]);
    expect(gallery.querySelector('.lm-gallery-layout-grid-3')).toBeTruthy();
    expect(within(gallery).getAllByRole('img')[0].getAttribute('src')).toBe(originalImages[1].url);
});

test('upload preserves draft layout and order; cancel removes only the new upload', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'multi' } });
    fireEvent.click(within(gallery).getByRole('button', { name: 'Move image 2 earlier' }));
    api.post.mockImplementation(() => {
        savedCard = { ...savedCard, images: [...originalImages, { imageID: 4, url: '/fixture-4.jpg' }] };
        return Promise.resolve({ data: { imageID: 4 } });
    });
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    fireEvent.change(input, { target: { files: [new File(['fixture'], 'fixture.png', { type: 'image/png' })] } });
    await waitFor(() => expect(within(gallery).getAllByRole('img')).toHaveLength(4));
    expect(screen.getByLabelText('Image layout').value).toBe('multi');
    expect(within(gallery).getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(['/fixture-2.jpg', '/fixture-1.jpg', '/fixture-3.jpg', '/fixture-4.jpg']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/deleteCardImage/4'));
    expect(api.delete).toHaveBeenCalledTimes(1);
});

test('failed order save keeps the draft open and allows retry', async () => {
    const gallery = await editCard();
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'multi' } });
    fireEvent.click(within(gallery).getByRole('button', { name: 'Move image 2 earlier' }));
    api.put.mockRejectedValueOnce(new Error('Fixture failure'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Image order could not be saved. Please try saving again.'));
    expect(screen.getByLabelText('Image layout').value).toBe('multi');
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
