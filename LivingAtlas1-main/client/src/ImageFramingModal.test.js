import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ImageFramingModal from './ImageFramingModal';
import { framingStyle } from './imageUploads';
jest.mock('./api', () => ({}));
jest.mock('react-modal', () => ({ __esModule: true, default: ({ children }) => <div role="dialog">{children}</div> }));

test('framing is non-destructive and supports full-image diagrams, zoom, reset and cancel', () => {
    const image = { url: '/display.webp', original_url: '/original.png', presentation: { fit: 'cover', x: 20, y: 70, zoom: 1.5 } };
    const onSave = jest.fn(), onClose = jest.fn();
    render(<ImageFramingModal image={image} aspectRatio={2} onSave={onSave} onClose={onClose} />);
    expect(screen.getByAltText('Framing preview').style.objectPosition).toBe('20% 70%');
    fireEvent.change(screen.getByLabelText('Image zoom'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Horizontal position'), { target: { value: '90' } });
    fireEvent.click(screen.getByText('Use framing'));
    expect(onSave).toHaveBeenCalledWith({ fit: 'cover', x: 90, y: 70, zoom: 2 });
    expect(image.presentation.x).toBe(20);
    fireEvent.click(screen.getByText('Show full image'));
    expect(screen.getByAltText('Framing preview').style.objectFit).toBe('contain');
    expect(screen.getByAltText('Framing preview').style.transform).toBe('none');
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByLabelText('Image zoom').value).toBe('1');
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('old images fill their frame by default and full view preserves every edge', () => {
    expect(framingStyle({})).toEqual({ objectFit: 'cover', objectPosition: '50% 50%', transform: 'scale(1)', transformOrigin: '50% 50%' });
    expect(framingStyle({ presentation: { fit: 'contain', zoom: 3 } }).transform).toBe('none');
});
