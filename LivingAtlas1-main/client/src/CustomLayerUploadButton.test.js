import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CustomLayerUploadButton from './CustomLayerUploadButton';

test('opens a nearby format menu and invokes a picker only after choosing an option', () => {
    const choose = jest.fn();
    render(<CustomLayerUploadButton onSelect={choose} />);
    const button = screen.getByRole('button', { name: 'Upload data' });
    button.getBoundingClientRect = () => ({ left: 120, top: 100, bottom: 130 });
    fireEvent.click(button);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ top: '136px', left: '120px' });
    expect(choose).not.toHaveBeenCalled();
    expect(within(menu).getByRole('group', { name: 'GIS data' })).toBeInTheDocument();
    expect(within(menu).getByRole('group', { name: 'StreamStats data' })).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'KML (.kml)' }));
    expect(choose).toHaveBeenCalledWith('kml');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
});

test('supports keyboard navigation, Escape and click-away dismissal', () => {
    render(<CustomLayerUploadButton onSelect={() => {}} />);
    const button = screen.getByRole('button', { name: 'Upload data' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'Escape' });
    expect(button).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
