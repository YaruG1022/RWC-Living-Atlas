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
  fireEvent.click(screen.getByTitle('Filter projects'));
  fireEvent.click(screen.getByLabelText('Show only favorited projects'));
  expect(screen.getByTestId('favorites').textContent).toBe('false');
  fireEvent.click(screen.getByText('Apply'));
  expect(screen.getByTestId('favorites').textContent).toBe('true');
  expect(screen.getByTitle('Filter projects').textContent).toContain('1');
  fireEvent.click(screen.getByTitle('Filter projects'));
  expect(screen.getByLabelText('Show only favorited projects').checked).toBe(true);
  fireEvent.click(screen.getByText('Clear'));
  expect(screen.getByTestId('favorites').textContent).toBe('false');
});

test('dismissed pending favorites does not apply', () => {
  render(<Harness />);
  fireEvent.click(screen.getByTitle('Filter projects'));
  fireEvent.click(screen.getByLabelText('Show only favorited projects'));
  fireEvent.mouseDown(document.body);
  fireEvent.click(screen.getByTitle('Filter projects'));
  expect(screen.getByLabelText('Show only favorited projects').checked).toBe(false);
  expect(screen.getByTestId('favorites').textContent).toBe('false');
});

test('signed-out visitors cannot enable favorites', () => {
  render(<Harness loggedIn={false} />);
  fireEvent.click(screen.getByTitle('Filter projects'));
  expect(screen.getByLabelText('Show only favorited projects').disabled).toBe(true);
  expect(screen.getByText('Log in to use favorites filter.')).toBeTruthy();
  fireEvent.click(screen.getByText('Apply'));
  expect(screen.getByTestId('favorites').textContent).toBe('false');
});


const initialViewport = {
  width: window.innerWidth,
  height: window.innerHeight,
};

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperties(window, {
    innerWidth: { configurable: true, writable: true, value: initialViewport.width },
    innerHeight: { configurable: true, writable: true, value: initialViewport.height },
  });
});

function bounds(left, top, width, height) {
  return {
    x: left, y: top, left, top, width, height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

function mockPlacement({
  viewportWidth = 1000,
  viewportHeight = 800,
  trigger = bounds(64, 120, 80, 36),
  menuHeight = 420,
  menuWidth = 280,
} = {}) {
  Object.defineProperties(window, {
    innerWidth: { configurable: true, writable: true, value: viewportWidth },
    innerHeight: { configurable: true, writable: true, value: viewportHeight },
  });
  let anchor = trigger;
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.getAttribute('role') === 'dialog'
      ? bounds(0, 0, menuWidth, menuHeight)
      : anchor;
  });
  return (nextAnchor) => { anchor = nextAnchor; };
}

function menuPosition(menu) {
  return {
    left: Number.parseFloat(menu.style.left),
    top: Number.parseFloat(menu.style.top),
    maxHeight: Number.parseFloat(menu.style.maxHeight),
  };
}

test('opens outside an overflow-clipped panel and distinguishes menu clicks from outside clicks', () => {
  const { container } = render(
    <div style={{ overflow: 'hidden', height: 32 }}><Harness /></div>
  );
  const trigger = screen.getByRole('button', { name: 'Filter projects' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(trigger);
  const menu = screen.getByRole('dialog', { name: 'Filter projects' });
  expect(document.body).toContainElement(menu);
  expect(container).not.toContainElement(menu);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(trigger.getAttribute('aria-controls')).toBeTruthy();
  expect(menu).toHaveAttribute('id', trigger.getAttribute('aria-controls'));

  const tagInput = screen.getByPlaceholderText('Enter tag...');
  fireEvent.mouseDown(tagInput);
  fireEvent.change(tagInput, { target: { value: 'river' } });
  const addTag = screen.getByRole('button', { name: 'Add Tag' });
  fireEvent.mouseDown(addTag);
  fireEvent.click(addTag);
  expect(screen.getByRole('dialog', { name: 'Filter projects' })).toBe(menu);
  expect(screen.getByText('river')).toBeInTheDocument();

  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('dialog', { name: 'Filter projects' })).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('keeps the menu within a narrow viewport while anchored below the trigger', () => {
  const triggerBounds = bounds(210, 80, 24, 32);
  const menuWidth = 224;
  mockPlacement({ viewportWidth: 240, viewportHeight: 640, trigger: triggerBounds, menuWidth });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter projects' }));

  const position = menuPosition(screen.getByRole('dialog', { name: 'Filter projects' }));
  expect(position.left).toBeGreaterThanOrEqual(8);
  expect(position.left + menuWidth).toBeLessThanOrEqual(window.innerWidth - 8);
  expect(position.top).toBe(triggerBounds.bottom + 6);
});

test('constrains a tall menu to the available height in a short viewport', () => {
  const menuHeight = 420;
  mockPlacement({
    viewportWidth: 640,
    viewportHeight: 240,
    trigger: bounds(120, 180, 80, 32),
    menuHeight,
  });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter projects' }));

  const position = menuPosition(screen.getByRole('dialog', { name: 'Filter projects' }));
  expect(position.top).toBeGreaterThanOrEqual(8);
  expect(position.maxHeight).toBeGreaterThan(0);
  expect(position.top + Math.min(menuHeight, position.maxHeight))
    .toBeLessThanOrEqual(window.innerHeight - 8);
});

test('repositions an open menu when the viewport resizes or an ancestor scrolls', () => {
  const menuWidth = 260;
  const moveTrigger = mockPlacement({ menuWidth });
  render(<div data-testid="scroll-panel" style={{ overflow: 'auto' }}><Harness /></div>);
  fireEvent.click(screen.getByRole('button', { name: 'Filter projects' }));
  const menu = screen.getByRole('dialog', { name: 'Filter projects' });
  const initialPosition = menuPosition(menu);

  const resizedBounds = bounds(600, 240, 80, 36);
  moveTrigger(resizedBounds);
  fireEvent.resize(window);
  const resizedPosition = menuPosition(menu);
  expect(resizedPosition.left + menuWidth).toBe(resizedBounds.right);
  expect(resizedPosition.top).toBe(resizedBounds.bottom + 6);
  expect(resizedPosition.top).not.toBe(initialPosition.top);

  const scrolledBounds = bounds(360, 72, 80, 36);
  moveTrigger(scrolledBounds);
  fireEvent.scroll(screen.getByTestId('scroll-panel'));
  const scrolledPosition = menuPosition(menu);
  expect(scrolledPosition.left + menuWidth).toBe(scrolledBounds.right);
  expect(scrolledPosition.top).toBe(scrolledBounds.bottom + 6);
  expect(screen.getByRole('dialog', { name: 'Filter projects' })).toBe(menu);
});

test('Escape dismisses pending changes and restores focus to the filter trigger', () => {
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Filter projects' });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByLabelText('Show only favorited projects'));
  const tagInput = screen.getByPlaceholderText('Enter tag...');
  tagInput.focus();

  fireEvent.keyDown(tagInput, { key: 'Escape', code: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Filter projects' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByTestId('favorites')).toHaveTextContent('false');

  fireEvent.click(trigger);
  expect(screen.getByLabelText('Show only favorited projects')).not.toBeChecked();
});
