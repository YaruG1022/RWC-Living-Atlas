import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LearnMoreGallery from './LearnMoreGallery';

const images = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, imageID: i + 1, url: `/image-${i + 1}.jpg`, alt: `Photo ${i + 1}` }));
const props = () => ({ images, coverUrl: images[0].url, editing: true, onLayoutChange: jest.fn(), onReorder: jest.fn(), onOpen: jest.fn(), onAdd: jest.fn(), onDelete: jest.fn() });

test.each([1, 2, 3, 4, 5, 6, 7, 8])('grid-%i shows the requested number of slots and marks the cover', count => {
    render(<LearnMoreGallery {...props()} layout={`grid-${count}`} />);
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(count);
    expect(screen.getByText('Card cover').parentElement.classList.contains('is-cover')).toBe(true);
});

test('layout changes and empty-slot uploads are delegated to the editor', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} images={images.slice(0, 2)} layout="grid-6" />);
    fireEvent.change(screen.getByLabelText('Image layout'), { target: { value: 'slideshow' } });
    expect(callbacks.onLayoutChange).toHaveBeenCalledWith('slideshow');
    fireEvent.click(screen.getByRole('button', { name: 'Add image 3' }));
    expect(callbacks.onAdd).toHaveBeenCalledWith(expect.anything(), 2);
});

test('dragging and keyboard-accessible arrows reorder images without opening the preview', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} layout="grid-6" />);
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

test('slideshow wraps in both directions and jumps to any image, including beyond six', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} editing={false} layout="slideshow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous gallery image' }));
    expect(screen.getByRole('img').getAttribute('src')).toBe(images[7].url);
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
    fireEvent.click(screen.getByRole('button', { name: 'Show gallery image 8' }));
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

test('eight-image cards cannot upload more while all eight remain navigable', () => {
    const callbacks = props();
    render(<LearnMoreGallery {...callbacks} layout="slideshow" />);
    fireEvent.click(screen.getByRole('button', { name: '8-image limit reached' }));
    expect(callbacks.onAdd).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /^Show gallery image/ })).toHaveLength(8);
    expect(screen.getByLabelText('Image layout').querySelector('option[value="grid-8"]')).toBeTruthy();
});

test.each([false, true])('a single image fills the gallery without empty slots (editing=%s)', editing => {
    const callbacks = props();
    const { container } = render(<LearnMoreGallery {...callbacks} images={images.slice(0, 1)} layout="featured" editing={editing} />);
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(1);
    expect(screen.queryByText('No image')).toBeNull();
    expect(container.querySelectorAll('.lm-gallery-cell')).toHaveLength(1);
    expect(container.querySelector('.lm-gallery-layout-grid-1')).toBeTruthy();
    if (editing) {
        fireEvent.click(screen.getByRole('button', { name: '+ Add image' }));
        expect(callbacks.onAdd).toHaveBeenCalledWith(expect.anything(), null);
    }
});
