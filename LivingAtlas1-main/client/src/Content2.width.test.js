import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Content2 from './Content2';
import api from './api';

jest.mock('./Card', () => () => null);
jest.mock('axios', () => ({}));
jest.mock('./FormModal', () => () => null);
jest.mock('./FilterDropdown', () => () => null);
jest.mock('./SortDropdown', () => () => null);
jest.mock('./OnboardingCardPanel', () => () => null);
jest.mock('./Content1', () => ({ curLocationCoordinates: {}, searchLocationCoordinates: {} }));
jest.mock('./Filter', () => ({ showAll: jest.fn(), filterCategory: jest.fn(), filterTag: jest.fn(), filterCategoryAndTag: jest.fn() }));
jest.mock('./api', () => ({ get: jest.fn(() => Promise.resolve({ data: { data: [] } })) }));

beforeEach(() => {
    api.get.mockResolvedValue({ data: { data: [] } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function Harness({ mode = 'grid', side = 'right', uploadOpen = false }) {
    const [gridWidth, setGridWidth] = useState(560);
    const [list, setList] = useState(mode === 'list');
    return <MemoryRouter>
        <output data-testid="grid-width">{gridWidth}</output>
        <output data-testid="map-width">{list ? 310 : gridWidth}</output>
        <Content2 cardPanelWidth={gridWidth} setCardPanelWidth={setGridWidth}
            onCardListViewChange={setList} initialCardViewMode={mode}
            cardPanelSide={side} isUploadPanelOpen={uploadOpen} isCollapsed={false}
            filterCondition="" searchCondition="" CategoryCondition="" sortCondition=""
            boundCondition="" />
    </MemoryRouter>;
}

const expectWidths = (container, panel, map) => {
    expect(container.querySelector('#content-2').style.width).toBe(`${panel}px`);
    expect(screen.getByTestId('grid-width').textContent).toBe('560');
    expect(screen.getByTestId('map-width').textContent).toBe(String(map));
};

test('repeated grid/list switches preserve the grid width and synchronize map space', async () => {
    const { container } = render(<Harness />);
    for (let i = 0; i < 5; i += 1) {
        expectWidths(container, 560, 560);
        expect(container.querySelector('.card-panel-resize-handle')).toBeTruthy();
        fireEvent.click(screen.getByTitle('List View'));
        await waitFor(() => expectWidths(container, 310, 310));
        expect(container.querySelector('.card-panel-resize-handle')).toBeNull();
        fireEvent.click(screen.getByTitle('Grid View'));
        await waitFor(() => expectWidths(container, 560, 560));
    }
});

test('an initial list preference never overwrites grid width', async () => {
    const { container } = render(<Harness mode="list" />);
    await waitFor(() => expectWidths(container, 310, 310));
    fireEvent.click(screen.getByTitle('Grid View'));
    await waitFor(() => expectWidths(container, 560, 560));
});

test('forced split-panel list mode restores the grid without changing its width', async () => {
    const { container, rerender } = render(<Harness side="left" uploadOpen />);
    await waitFor(() => expectWidths(container, 310, 310));
    expect(screen.getByTitle('Grid View').disabled).toBe(true);
    rerender(<Harness side="left" uploadOpen={false} />);
    await waitFor(() => expectWidths(container, 560, 560));
});
