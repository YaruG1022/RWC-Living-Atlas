import { act, cleanup, renderHook } from '@testing-library/react';
import api from './api';
import { storeSession } from './authSession';
import useSessionHeartbeat from './useSessionHeartbeat';

jest.mock('./api', () => ({ post: jest.fn() }));

const primaryEmail = 'presence@example.invalid';
const otherEmail = 'other@example.invalid';
let visibility;
let network;

function setTestSession(email, token) {
    localStorage.setItem('email', email);
    storeSession(email, token);
}

const tick = ms => act(async () => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
    jest.useFakeTimers();
    visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    network = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    api.post.mockReset().mockResolvedValue({ status: 204 });
});

afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test('sends only when the page has a server session for the active account', async () => {
    const { rerender } = renderHook(({ email }) => useSessionHeartbeat(email), { initialProps: { email: '' } });
    setTestSession(otherEmail, 'other-session');
    localStorage.setItem('email', primaryEmail);
    rerender({ email: primaryEmail });
    await tick(45_000);
    expect(api.post).not.toHaveBeenCalled();

    setTestSession(primaryEmail, 'active-session');
    await tick(45_000);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/session/heartbeat', null, expect.objectContaining({
        headers: { Authorization: 'Bearer active-session' },
        skipRetry: true,
        signal: expect.any(AbortSignal),
    }));
});

test('pauses in the background and sends on return or reconnection', async () => {
    setTestSession(primaryEmail, 'active-session');
    visibility.mockReturnValue('hidden');
    renderHook(() => useSessionHeartbeat(primaryEmail));
    await tick(90_000);
    expect(api.post).not.toHaveBeenCalled();

    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(api.post).toHaveBeenCalledTimes(1);

    network.mockReturnValue(false);
    await tick(45_000);
    expect(api.post).toHaveBeenCalledTimes(1);
    network.mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(api.post).toHaveBeenCalledTimes(2);
    await tick(45_000);
    expect(api.post).toHaveBeenCalledTimes(3);
});

test('keeps one request in flight and cancels it when switching accounts or signing out', async () => {
    setTestSession(primaryEmail, 'active-session');
    api.post.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ email }) => useSessionHeartbeat(email), { initialProps: { email: primaryEmail } });
    const firstRequest = api.post.mock.calls[0][2];
    await tick(90_000);
    expect(api.post).toHaveBeenCalledTimes(1);

    setTestSession(otherEmail, 'other-session');
    rerender({ email: otherEmail });
    expect(firstRequest.signal.aborted).toBe(true);
    expect(api.post).toHaveBeenCalledTimes(2);
    const secondRequest = api.post.mock.calls[1][2];
    expect(secondRequest.headers.Authorization).toBe('Bearer other-session');

    rerender({ email: '' });
    expect(secondRequest.signal.aborted).toBe(true);
    await tick(90_000);
    expect(api.post).toHaveBeenCalledTimes(2);
});

test('retries a transient failure on schedule and stops polling a rejected token', async () => {
    setTestSession(primaryEmail, 'active-session');
    api.post
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockRejectedValueOnce({ response: { status: 401 } });
    renderHook(() => useSessionHeartbeat(primaryEmail));
    await tick(0);
    await tick(45_000);
    expect(api.post).toHaveBeenCalledTimes(2);
    await tick(90_000);
    expect(api.post).toHaveBeenCalledTimes(2);

    setTestSession(primaryEmail, 'replacement-session');
    await tick(45_000);
    expect(api.post).toHaveBeenCalledTimes(3);
    expect(api.post.mock.calls.at(-1)[2].headers.Authorization).toBe('Bearer replacement-session');
});
