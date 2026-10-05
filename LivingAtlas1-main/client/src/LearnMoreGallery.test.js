import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LearnMoreGallery, { GalleryLayoutSelector } from './LearnMoreGallery';

const images = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, imageID: i + 1, url: `/image-${i + 1}.jpg`, alt: `Photo ${i + 1}` }));
const props = () => ({ images, coverUrl: images[0].url, editing: true, onLayoutChange: jest.fn(), onReorder: jest.fn(), onOpen: jest.fn(), onAdd: jest.fn(), onDelete: jest.fn() });

test.each(['multi', 'slideshow'])('%s marks the cover only while editing', layout => {
    const callbacks = props();
    const { container, rerender } = render(<LearnMoreGallery {...callbacks} layout={layout} editing={false} />);
    expect(container.querySelector('.is-cover')).toBeNull();
    expect(screen.queryByText('Card cover')).toBeNull();
    rerender(<LearnMoreGallery {...callbacks} layout={layout} editing />);
    expect(container.querySelector('.is-cover')).toBeTruthy();
    expect(screen.getByText('Card cover')).toBeTruthy();
});

test.each([1, 2, 3, 4, 5, 6])('grid-%i shows the requested number of slots and marks the cover', count => {
    render(<LearnMoreGallery {...props()} images={images.slice(0, count)} layout="multi" />);
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(count);
    expect(screen.getByText('Card cover').parentElement.classList.contains('is-cover')).toBe(true);
});

test.each(['grid-7', 'grid-8'])('legacy %s displays six images without removing the remaining images', layout => {
    render(<LearnMoreGallery {...props()} layout={layout} />);
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(6);
    expect(screen.queryByLabelText('Image layout')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add image' })).toBeNull();
});

test('layout changes are delegated and the main page has no add-image button', () => {
    const callbacks = props();
    render(<><LearnMoreGallery {...callbacks} images={images.slice(0, 2)} layout="grid-6" /><GalleryLayoutSelector layout="grid-6" onChange={callbacks.onLayoutChange} /></>);
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'slideshow' } });
    expect(callbacks.onLayoutChange).toHaveBeenCalledWith('slideshow');
    expect(Array.from(screen.getByLabelText('Image layout').options).map(option => option.value)).toEqual(['multi', 'slideshow']);
    expect(screen.queryByRole('button', { name: '+ Add image' })).toBeNull();
});

test('dragging and keyboard-accessible arrows reorder images without opening the preview', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} layout="grid-6" />);
    expect(screen.getByRole('button', { name: 'Move image 2 earlier' }).querySelector('svg[data-icon="arrow-left"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move image 2 later' }).querySelector('svg[data-icon="arrow-right"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete image 2' }).querySelector('svg[data-icon="xmark"]')).toBeTruthy();
    expect(document.querySelector('.lm-gallery-tile-tools svg[data-icon="grip-vertical"]')).toBeTruthy();
    const dataTransfer = { setData: jest.fn() };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Open image 3' }).parentElement, { dataTransfer });
    const target = screen.getByRole('button', { name: 'Open image 1' }).parentElement;
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(callbacks.onReorder).toHaveBeenCalledWith(2, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 earlier' }));
    expect(callbacks.onReorder).toHaveBeenCalledWith(1, 0);
    expect(callbacks.onOpen).not.toHaveBeenCalled();
});

test('slideshow wraps and jumps within the six displayed images', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} editing={false} layout="slideshow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous gallery image' }));
    expect(screen.getByRole('img').getAttribute('src')).toBe(images[5].url);
    fireEvent.click(screen.getByRole('button', { name: 'Next gallery image' }));
    expect(screen.getByRole('img').getAttribute('src')).toBe(images[0].url);
    fireEvent.click(screen.getByRole('button', { name: 'Show gallery image 6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open image 6' }));
    expect(callbacks.onOpen).toHaveBeenCalledWith(expect.anything(), 5);
    expect(screen.queryByLabelText('Image layout')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move image 6 earlier' })).toBeNull();
});

test('deleting the active slide clamps the index and an empty slideshow stays usable', () => {
    const callbacks = props();
    const { rerender } = render(<LearnMoreGallery {...callbacks} layout="slideshow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show gallery image 6' }));
    rerender(<LearnMoreGallery {...callbacks} images={images.slice(0, 2)} layout="slideshow" />);
    expect(screen.getByRole('img').getAttribute('src')).toBe(images[1].url);
    rerender(<LearnMoreGallery {...callbacks} images={[]} layout="slideshow" />);
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add image 1' }));
    expect(callbacks.onAdd).toHaveBeenCalledWith(expect.anything(), 0);
});

test('busy editor blocks mutations; cover marking follows its image rather than its slot', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} busy layout="grid-2" coverUrl={images[1].url} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete image 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 earlier' }));
    expect(callbacks.onDelete).not.toHaveBeenCalled();
    expect(callbacks.onReorder).not.toHaveBeenCalled();
    expect(screen.getByText('Card cover').parentElement.querySelector('img').getAttribute('src')).toBe(images[1].url);
});

test('eight-image cards display six slides while the selector offers only two modes', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} layout="slideshow" />);
    expect(screen.queryByRole('button', { name: '+ Add image' })).toBeNull();
    expect(callbacks.onAdd).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /^Show gallery image/ })).toHaveLength(6);
    expect(screen.queryByLabelText('Image layout')).toBeNull();
});

test.each([false, true])('a single image fills the gallery without empty slots (editing=%s)', editing => {
    const callbacks = props();
    const { container } = render(<LearnMoreGallery {...callbacks} images={images.slice(0, 1)} layout="featured" editing={editing} />);
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(1);
    expect(screen.queryByText('No image')).toBeNull();
    expect(container.querySelectorAll('.lm-gallery-cell')).toHaveLength(1);
    expect(container.querySelector('.lm-gallery-layout-grid-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Add image' })).toBeNull();
});
