import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormModal from './FormModal';
import api from './api';

jest.mock('./api', () => ({ post: jest.fn() }));
jest.mock('./RichTextEditor', () => () => null);
jest.mock('./PolygonDrawingModal', () => () => null);
jest.mock('./CoordinatesPanel', () => () => null);
jest.mock('./ArcGISPickerModal', () => () => null);
jest.mock('./CustomLayerPickerModal', () => () => null);
jest.mock('./OnboardingCreateCardModal', () => () => null);
jest.mock('react-modal', () => ({ __esModule: true, default: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null }));

const account = { username: 'river-researcher', email: 'different.email@example.invalid' };
const view = props => <FormModal isOpen {...props} />;
const field = name => screen.getByRole('dialog').querySelector(`[name="${name}"]`);
const fillProject = () => {
    for (const [name, value] of Object.entries({ name: 'Project author', title: 'River project', latitude: '46', longitude: '-117' })) {
        fireEvent.change(field(name), { target: { value } });
    }
};
const submit = () => fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    api.post.mockResolvedValue({ data: { card_id: 101 } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('uses the current account when login arrives after the modal mounted', async () => {
    const { rerender } = render(view({}));
    rerender(view(account));
    expect(field('contact_email').value).toBe(account.email);
    expect(field('contact_email').readOnly).toBe(false);
    fillProject();
    submit();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const payload = api.post.mock.calls[0][1];
    expect(payload.get('username')).toBe(account.username);
    expect(payload.get('email')).toBe(account.email);
    expect(payload.get('contact_email')).toBe(account.email);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Upload Successful'));
});

test('switching accounts uses the new username and email together', async () => {
    const { rerender } = render(view(account));
    fillProject();
    rerender(view({ username: 'new-contributor', email: 'new@example.invalid' }));
    expect(field('contact_email').value).toBe('new@example.invalid');
    submit();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1].get('username')).toBe('new-contributor');
    expect(api.post.mock.calls[0][1].get('email')).toBe('new@example.invalid');
});

test.each([{ username: account.username }, { email: account.email }, {}])('missing account identity stops upload and explains recovery: %j', props => {
    render(view(props));
    fillProject();
    submit();
    expect(api.post).not.toHaveBeenCalled();
    expect(window.alert.mock.calls[0][0]).toContain('sign in again');
});

test.each([
    [{ response: { data: { detail: 'Email must match the registered account.' } } }, 'Email must match the registered account.'],
    [{ response: { data: { detail: [{ loc: ['body', 'email'], msg: 'field required' }] } } }, 'email: field required'],
    [new Error('Network Error'), 'Unable to reach the server. Check your connection and try again.'],
    [{ response: { status: 500, data: {} } }, 'Please try again. If the problem continues, contact support.'],
])('explains upload failures and preserves the draft for retry', async (error, message) => {
    api.post.mockRejectedValueOnce(error);
    const onRequestClose = jest.fn();
    render(view({ ...account, onRequestClose }));
    fillProject();
    submit();
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(`Upload failed: ${message}`));
    expect(field('title').value).toBe('River project');
    expect(onRequestClose).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Upload Successful'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
});


test('a different contact email is submitted separately from account ownership', async () => {
    const { rerender } = render(view({}));
    fireEvent.change(field('contact_email'), { target: { value: 'colleague@example.invalid' } });
    rerender(view(account));
    expect(field('contact_email').value).toBe('colleague@example.invalid');
    fillProject();
    submit();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const payload = api.post.mock.calls[0][1];
    expect(payload.get('email')).toBe(account.email);
    expect(payload.get('username')).toBe(account.username);
    expect(payload.get('contact_email')).toBe('colleague@example.invalid');
});

test('a private upload sends the boolean value understood by the backend', async () => {
    render(view(account));
    fillProject();
    fireEvent.change(field('is_public'), { target: { value: 'false' } });
    submit();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1].get('is_public')).toBe('false');
});

test('large images get bounded previews; partial uploads retry only failures without creating another project', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:display');
    URL.revokeObjectURL = jest.fn();
    let failSecond = true;
    api.post.mockImplementation((url, body) => {
        if (url === '/imagePreview') return Promise.resolve({ data: new Blob(['display'], { type: 'image/webp' }) });
        if (url === '/uploadForm') return Promise.resolve({ data: { card_id: 101 } });
        if (body.get('image').name === 'second.png' && failSecond) {
            failSecond = false;
            return Promise.reject({ response: { data: { detail: 'Temporary storage failure' } } });
        }
        return Promise.resolve({ data: { imageID: 7 } });
    });
    render(view(account));
    fillProject();
    const first = new File([new Uint8Array(11 * 1024 * 1024)], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"][accept^="image/"]'), { target: { files: [first, second] } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Adjust framing' })).toHaveLength(2));
    submit();
    const retry = await screen.findByRole('button', { name: 'Retry remaining images' });
    await waitFor(() => expect(retry.disabled).toBe(false));
    expect(screen.getByText(/Project created. Some images failed/)).toBeTruthy();
    const token = api.post.mock.calls.find(([url, body]) => url === '/uploadCardImage' && body.get('image').name === 'second.png')[1].get('upload_token');
    fireEvent.click(retry);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Upload Successful'));
    expect(api.post.mock.calls.filter(([url]) => url === '/uploadForm')).toHaveLength(1);
    const uploads = api.post.mock.calls.filter(([url]) => url === '/uploadCardImage');
    expect(uploads.map(([, body]) => body.get('image').name)).toEqual(['first.png', 'second.png', 'second.png']);
    expect(uploads[2][1].get('upload_token')).toBe(token);
    expect(uploads[0][1].get('presentation')).toContain('cover');
});
