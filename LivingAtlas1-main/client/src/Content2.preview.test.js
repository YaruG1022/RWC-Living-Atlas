import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Content2 from './Content2';
import api from './api';

jest.mock('./Card', () => ({ formData }) => <div className="card">{formData.title} preview</div>);
jest.mock('axios', () => ({}));
jest.mock('./FormModal', () => () => null);
jest.mock('./FilterDropdown', () => () => null);
jest.mock('./SortDropdown', () => () => null);
jest.mock('./OnboardingCardPanel', () => () => null);
jest.mock('./Content1', () => ({ curLocationCoordinates: {}, searchLocationCoordinates: {} }));
jest.mock('./Filter', () => ({ showAll: jest.fn(), filterCategory: jest.fn(), filterTag: jest.fn(), filterCategoryAndTag: jest.fn() }));
jest.mock('./api', () => ({ get: jest.fn(() => Promise.resolve({ data: { data: [{cardID: 1, title: 'River'}, {cardID: 2, title: 'Basin'}] } })) }));

const props = {
    initialCardViewMode: 'list', cardPanelSide: 'right', isCollapsed: false,
    filterCondition: '', searchCondition: '', CategoryCondition: '', sortCondition: '', boundCondition: ''
};
const view = overrides => <MemoryRouter><Content2 {...props} {...overrides} /></MemoryRouter>;
const preview = () => document.querySelector('.card-list-hover-preview');
const advance = ms => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => {
    api.get.mockResolvedValue({data: {data: [{cardID: 1, title: 'River'}, {cardID: 2, title: 'Basin'}]}});
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({left: 600, right: 910, top: 180, bottom: 700, width: 310, height: 520});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function setup(overrides) {
    const result = render(view(overrides));
    await act(async () => { await Promise.resolve(); });
    return {...result, row: result.container.querySelector('.card-list-item')};
}

test('shows the grid card after 500ms on the map side and dismisses on leave', async () => {
    const {row} = await setup();
    fireEvent.mouseEnter(row);
    advance(499);
    expect(preview().style.display).toBe('none');
    advance(1);
    expect(preview().style.display).toBe('');
    expect(preview().style.left).toBe('352px');
    expect(preview().textContent).toContain('River preview');
    fireEvent.mouseLeave(row);
    expect(preview().style.display).toBe('none');
});

test('leaving before the delay prevents a stale preview', async () => {
    const {row} = await setup();
    fireEvent.mouseEnter(row);
    advance(200);
    fireEvent.mouseLeave(row);
    advance(500);
    expect(preview().style.display).toBe('none');
});

test('moving between rows cancels the earlier card timer', async () => {
    const {container, row} = await setup();
    fireEvent.mouseEnter(row);
    advance(300);
    fireEvent.mouseLeave(row);
    fireEvent.mouseEnter(container.querySelectorAll('.card-list-item')[1]);
    advance(200);
    expect([...document.querySelectorAll('.card-list-hover-preview')].every(e => e.style.display === 'none')).toBe(true);
    advance(300);
    const visible = [...document.querySelectorAll('.card-list-hover-preview')].filter(e => e.style.display !== 'none');
    expect(visible).toHaveLength(1);
    expect(visible[0].textContent).toContain('Basin preview');
    fireEvent.resize(window);
    expect(visible[0].style.display).toBe('none');
});

test('left panel previews appear on the right and scrolling clears them', async () => {
    HTMLElement.prototype.getBoundingClientRect.mockReturnValue({left: 50, right: 360, top: 180, bottom: 700, width: 310, height: 520});
    const {row, container} = await setup({cardPanelSide: 'left'});
    fireEvent.mouseEnter(row);
    advance(500);
    expect(preview().style.left).toBe('368px');
    fireEvent.scroll(container.querySelector('.card-container'));
    expect(preview().style.display).toBe('none');
});

test('switching view or unmounting cancels pending previews', async () => {
    const {row, unmount} = await setup();
    fireEvent.mouseEnter(row);
    fireEvent.click(screen.getByTitle('Grid View'));
    advance(500);
    expect(preview()).toBeNull();
    fireEvent.click(screen.getByTitle('List View'));
    fireEvent.mouseEnter(document.querySelector('.card-list-item'));
    unmount();
    advance(500);
    expect(preview()).toBeNull();
});
