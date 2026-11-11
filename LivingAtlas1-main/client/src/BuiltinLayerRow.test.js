import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BuiltinLayerRow from './BuiltinLayerRow';
import { BUILTIN_LAYERS } from './builtinLayers';

const layer = BUILTIN_LAYERS[0];

afterEach(() => {
    jest.restoreAllMocks();
    delete window.atlasMapInstance;
});

test('help opens a nearby source dialog without selecting the layer; Escape returns focus', async () => {
    const toggle = jest.fn();
    render(<BuiltinLayerRow layer={layer} onToggle={toggle} />);
    const button = screen.getByRole('button', { name: `About ${layer.label}` });
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: layer.label });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(layer.description)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: layer.sourceLabel })).toHaveAttribute('href', layer.sourceUrl);
    expect(toggle).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
});

test('outside click dismisses; region action zooms without changing selection', async () => {
    const toggle = jest.fn();
    window.atlasMapInstance = { fitBounds: jest.fn() };
    render(<BuiltinLayerRow layer={layer} onToggle={toggle} />);
    const help = screen.getByRole('button', { name: `About ${layer.label}` });
    fireEvent.click(help);
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(dialog.parentElement);
    fireEvent.mouseUp(dialog.parentElement);
    fireEvent.click(dialog.parentElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(help);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to region' }));
    expect(window.atlasMapInstance.fitBounds).toHaveBeenCalledWith(layer.bounds, { padding: 40, duration: 800 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).not.toHaveBeenCalled();
});

test('dialog stays by its trigger and clamps to a smaller viewport after resize', async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    let anchor = { left: 278, right: 300, top: 120, bottom: 142, width: 22, height: 22 };
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
        return this.classList.contains('builtin-layer-dialog')
            ? { left: 0, top: 0, width: 320, height: 180, right: 320, bottom: 180 } : anchor;
    });
    try {
        window.innerWidth = 1000; window.innerHeight = 700;
        render(<BuiltinLayerRow layer={layer} />);
        fireEvent.click(screen.getByRole('button', { name: `About ${layer.label}` }));
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog.style.left).toBe('308px'));
        expect(dialog.style.top).toBe('110px');
        anchor = { left: 340, right: 362, top: 185, bottom: 207, width: 22, height: 22 };
        window.innerWidth = 390; window.innerHeight = 220;
        fireEvent(window, new Event('resize'));
        expect(parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(8);
        expect(parseFloat(dialog.style.left) + 320).toBeLessThanOrEqual(382);
        expect(parseFloat(dialog.style.top) + 180).toBeLessThanOrEqual(212);
        fireEvent.click(screen.getByRole('button', { name: 'Close layer information' }));
    } finally {
        window.innerWidth = originalWidth; window.innerHeight = originalHeight;
    }
});
