import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatbotWidget from './ChatbotWidget';
import api from './api';
jest.mock('./api', () => ({ post: jest.fn() }));
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeAll(() => { HTMLElement.prototype.scrollIntoView = jest.fn(); });
afterAll(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView; });
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView.mockClear();
  api.post.mockReset();
});
afterEach(() => jest.restoreAllMocks());
test('a helper answer displays service-generated chapter sources and sends only role/text history', async () => {
  api.post.mockResolvedValue({ data: { answer: 'Open the card form.', sources: [{
    section_id: 'add-card', title: 'Card Creation Form', url: 'https://atlas.example/user-manual?section=add-card',
    version: `${'a'.repeat(40)}-${'b'.repeat(12)}` }] } });
  render(<ChatbotWidget displayMode="sidebar" isOpen />);
  fireEvent.change(screen.getByPlaceholderText('Ask a question…'), { target: { value: 'How do I create a card?' } });
  fireEvent.keyDown(screen.getByPlaceholderText('Ask a question…'), { key: 'Enter' });
  expect(await screen.findByRole('link', { name: 'Card Creation Form' })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Ask a question…'), { target: { value: 'What next?' } });
  fireEvent.keyDown(screen.getByPlaceholderText('Ask a question…'), { key: 'Enter' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1].history.every(item => Object.keys(item).sort().join() === 'role,text')).toBe(true);
});
