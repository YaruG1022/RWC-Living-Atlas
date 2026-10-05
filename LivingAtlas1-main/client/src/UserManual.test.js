import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import UserManual from './UserManual';

beforeEach(() => { jest.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

test('manual navigation renders each guide without broken gallery callbacks', () => {
  render(<UserManual />);
  const sections = ['Feature Search Panel', 'Atlas Helper', 'Card Container', 'Card Panel Toolbar', 'Card Detail View', 'Card Creation Form', 'ArcGIS Picker Modal', 'ArcGIS Upload Panel', 'Custom Layers Panel', 'Service / Layer Info Modal', 'Basemap Panel', 'Watershed Panel', 'Map Controls'];
  for (const name of sections) {
    fireEvent.click(screen.getByRole('button', { name, exact: true }));
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Card Detail View', exact: true }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Open image 1' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Move image 1 later' }));
});
