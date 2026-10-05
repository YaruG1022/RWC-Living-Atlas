import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FilterDropdown from './FilterDropdown';

function Harness({ loggedIn = true }) {
  const [favorites, setFavorites] = useState(false);
  return <>
    <output data-testid="favorites">{String(favorites)}</output>
    <FilterDropdown categoryValue="" activeTagFilters={[]}
      onCategoryChange={() => {}} onTagFiltersChange={() => {}}
      canUseFavorites={loggedIn} favoritesOnly={favorites} onFavoritesChange={setFavorites} />
  </>;
}

test('favorites is staged, applied, counted and reset by Clear', () => {
  render(<Harness />);
  fireEvent.click(screen.getByTitle('Filter cards'));
  fireEvent.click(screen.getByLabelText('Show only favorited cards'));
  expect(screen.getByTestId('favorites').textContent).toBe('false');
  fireEvent.click(screen.getByText('Apply'));
  expect(screen.getByTestId('favorites').textContent).toBe('true');
  expect(screen.getByTitle('Filter cards').textContent).toContain('1');
  fireEvent.click(screen.getByTitle('Filter cards'));
  expect(screen.getByLabelText('Show only favorited cards').checked).toBe(true);
  fireEvent.click(screen.getByText('Clear'));
  expect(screen.getByTestId('favorites').textContent).toBe('false');
});

test('dismissed pending favorites does not apply', () => {
  render(<Harness />);
  fireEvent.click(screen.getByTitle('Filter cards'));
  fireEvent.click(screen.getByLabelText('Show only favorited cards'));
  fireEvent.mouseDown(document.body);
  fireEvent.click(screen.getByTitle('Filter cards'));
  expect(screen.getByLabelText('Show only favorited cards').checked).toBe(false);
  expect(screen.getByTestId('favorites').textContent).toBe('false');
});

test('signed-out visitors cannot enable favorites', () => {
  render(<Harness loggedIn={false} />);
  fireEvent.click(screen.getByTitle('Filter cards'));
  expect(screen.getByLabelText('Show only favorited cards').disabled).toBe(true);
  expect(screen.getByText('Log in to use favorites filter.')).toBeTruthy();
  fireEvent.click(screen.getByText('Apply'));
  expect(screen.getByTestId('favorites').textContent).toBe('false');
});
