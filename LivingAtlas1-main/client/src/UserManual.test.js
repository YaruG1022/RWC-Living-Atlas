import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import UserManual from './UserManual';

beforeEach(() => {
  window.history.replaceState({}, '', '/user-manual');
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

test('manual navigation renders each guide without broken gallery callbacks', () => {
  render(<UserManual />);
  const sections = ['Navigation & Preferences', 'Login, Registration & Passwords', 'Profile & Administration', 'Tutorials & Updates', 'Feature Search Panel', 'Atlas Helper', 'Card Container', 'Card Panel Toolbar', 'Card Detail View', 'Card Creation Form', 'ArcGIS Picker Modal', 'ArcGIS Upload Panel', 'Custom Layers Panel', 'Service / Layer Info Modal', 'Basemap Panel', 'Watershed Panel', 'Map Controls', 'Add Points / Coordinates', 'Polygon Tools', 'Add PNG'];
  for (const name of sections) {
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name, exact: true }));
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Card Detail View', exact: true }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Open image 1' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Move image 1 later' }));
});

test.each([
  ['navigation', 'Navigation & Preferences'],
  ['accounts', 'Login, Registration & Passwords'],
  ['profile-admin', 'Profile & Administration'],
  ['tutorials-updates', 'Tutorials & Updates'],
])('opens the supplemental chapter from its shareable URL: %s', (id, heading) => {
  window.history.replaceState({}, '', `/user-manual?section=${id}`);
  render(<UserManual />);
  expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
  expect(within(screen.getByRole('navigation')).getByRole('button', { name: heading }))
    .toHaveClass('active');
  expect(screen.queryByRole('heading', { name: 'Welcome to the User Manual' })).not.toBeInTheDocument();
});

test('unknown chapter URLs fall back to the overview and keep navigation usable', () => {
  window.history.replaceState({}, '', '/user-manual?section=unknown-chapter');
  render(<UserManual />);
  expect(screen.getByRole('heading', { name: 'Welcome to the User Manual' })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Navigation & Preferences' }));
  expect(screen.getByRole('link', { name: 'Card Creation Form' }))
    .toHaveAttribute('href', '/user-manual?section=add-card');
});
