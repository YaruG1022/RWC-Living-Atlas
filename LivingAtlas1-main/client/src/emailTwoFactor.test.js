import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import api from './api';
import { getSessionToken, storeSession } from './authSession';
import Login from './Login';
import Profile from './Profile';
import SwitchAccount from './SwitchAccount';

jest.mock('./api', () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
}));

const accountEmail = 'member@example.invalid';
const password = 'fixture-password';
const challengeId = 'fixture-challenge';
const loginResponse = {
    'Account Information': [['Member', accountEmail, false]],
    session_token: 'issued-session',
};

beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
});

afterEach(() => jest.useRealTimers());

function renderAt(path, component, initialProps = {}) {
    const Page = component;
    const history = createMemoryHistory({ initialEntries: [path] });
    const props = {
        email: '',
        password,
        setEmail: jest.fn(),
        setPassword: jest.fn(),
        setMessage: jest.fn(),
        setIsLoggedIn: jest.fn(),
        setUsername: jest.fn(),
        setIsAdmin: jest.fn(),
        ...initialProps,
    };
    render(<Router history={history}><Page {...props} /></Router>);
    return { history, ...props };
}

function startLogin() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: accountEmail } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
}

function submitCode(field, code = '012345') {
    fireEvent.change(field, { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
}

test('opens the home page immediately after password-only sign-in', async () => {
    api.post.mockResolvedValueOnce({ data: loginResponse });
    const { history, setIsLoggedIn } = renderAt('/login', Login);
    startLogin();

    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
    expect(setIsLoggedIn).toHaveBeenCalledWith(true);
    expect(getSessionToken()).toBe(loginResponse.session_token);
});

test('requires a successful email code before completing sign-in', async () => {
    api.post
        .mockResolvedValueOnce({ data: { two_factor_required: true, challenge_id: challengeId } })
        .mockRejectedValueOnce({ response: { status: 401, data: { detail: 'Incorrect verification code.' } } })
        .mockResolvedValueOnce({ data: loginResponse });
    const { history, setIsLoggedIn } = renderAt('/login', Login);
    startLogin();

    const field = await screen.findByLabelText('Verification code');
    expect(field).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(history.location.pathname).toBe('/login');
    expect(getSessionToken(false)).toBeNull();
    expect(localStorage.getItem('savedAccounts')).toBeNull();

    submitCode(field, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect verification code.');
    expect(history.location.pathname).toBe('/login');
    expect(setIsLoggedIn).not.toHaveBeenCalled();
    expect(getSessionToken(false)).toBeNull();

    submitCode(field, '012 345');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(api.post).toHaveBeenLastCalledWith('/profileAccount/verify', {
        challenge_id: challengeId,
        code: '012345',
    }, expect.objectContaining({ skipRetry: true }));
    expect(setIsLoggedIn).toHaveBeenCalledWith(true);
    expect(getSessionToken()).toBe(loginResponse.session_token);
});

test('resends in place after the cooldown and honors Retry-After', async () => {
    jest.useFakeTimers();
    api.post
        .mockResolvedValueOnce({ data: { two_factor_required: true, challenge_id: challengeId, resend_after: 60 } })
        .mockRejectedValueOnce({ response: {
            status: 429,
            headers: { 'retry-after': '3' },
            data: { detail: 'Please wait before requesting another code.' },
        } })
        .mockResolvedValueOnce({ data: { challenge_id: challengeId, resend_after: 60 } })
        .mockResolvedValueOnce({ data: loginResponse });
    const { history, setIsLoggedIn } = renderAt('/login', Login);
    startLogin();

    const field = await screen.findByLabelText('Verification code');
    const resend = screen.getByRole('button', { name: 'Resend code' });
    expect(resend).toBeDisabled();
    fireEvent.click(resend);
    expect(api.post).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(60_000));
    expect(resend).toBeEnabled();
    fireEvent.click(resend);
    expect(screen.getByRole('button', { name: 'Verify code' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait before requesting another code.');
    expect(resend).toBeDisabled();
    act(() => jest.advanceTimersByTime(3_000));
    expect(resend).toBeEnabled();
    fireEvent.change(field, { target: { value: '000000' } });
    fireEvent.click(resend);

    expect(await screen.findByText('A new code was sent. Use the code from the latest email.')).toBeInTheDocument();
    expect(api.post).toHaveBeenLastCalledWith('/profileAccount/resend', {
        challenge_id: challengeId,
    }, expect.objectContaining({ skipRetry: true }));
    expect(field).toHaveValue('');
    expect(resend).toBeDisabled();
    expect(history.location.pathname).toBe('/login');
    expect(setIsLoggedIn).not.toHaveBeenCalled();
    expect(getSessionToken(false)).toBeNull();

    submitCode(field, '654321');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(getSessionToken()).toBe(loginResponse.session_token);
});

test('leaves the current account signed in until the switch is verified', async () => {
    jest.useFakeTimers();
    const previousEmail = 'previous@example.invalid';
    const previousToken = 'current-session';
    const headers = { Authorization: `Bearer ${previousToken}` };
    localStorage.setItem('email', previousEmail);
    localStorage.setItem('savedAccounts', JSON.stringify([{ email: accountEmail, username: 'Member', password }]));
    storeSession(previousEmail, previousToken);
    api.post
        .mockResolvedValueOnce({ data: { two_factor_required: true, challenge_id: challengeId, resend_after: 1 } })
        .mockResolvedValueOnce({ data: { challenge_id: challengeId, resend_after: 60 } })
        .mockResolvedValueOnce({ data: loginResponse });
    const { history, setEmail } = renderAt('/switch-account', SwitchAccount, { email: previousEmail });
    fireEvent.click(screen.getByRole('button', { name: /member/ }));

    const field = await screen.findByLabelText('Verification code');
    expect(getSessionToken()).toBe(previousToken);
    expect(setEmail).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await screen.findByText('A new code was sent. Use the code from the latest email.');
    expect(history.location.pathname).toBe('/switch-account');
    expect(getSessionToken()).toBe(previousToken);
    submitCode(field);

    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(api.post).toHaveBeenNthCalledWith(1, '/profileAccount', { email: accountEmail, password }, expect.objectContaining({ headers }));
    expect(api.post).toHaveBeenNthCalledWith(2, '/profileAccount/resend', {
        challenge_id: challengeId,
    }, expect.objectContaining({ headers, skipRetry: true }));
    expect(api.post).toHaveBeenNthCalledWith(3, '/profileAccount/verify', {
        challenge_id: challengeId,
        code: '012345',
    }, expect.objectContaining({ headers }));
    expect(setEmail).toHaveBeenCalledWith(accountEmail);
    expect(getSessionToken()).toBe(loginResponse.session_token);
});

test('returns to the password form after an expired code', async () => {
    api.post
        .mockResolvedValueOnce({ data: { two_factor_required: true, challenge_id: challengeId } })
        .mockRejectedValueOnce({ response: { status: 410, data: { detail: 'Request a new code.' } } });
    renderAt('/login', Login);
    startLogin();

    submitCode(await screen.findByLabelText('Verification code'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request a new code.');
    expect(screen.getByRole('button', { name: 'Verify code' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to login' }));
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(getSessionToken(false)).toBeNull();
});

test('confirms the mailbox before enabling the setting and requires the password to turn it off', async () => {
    jest.useFakeTimers();
    api.get.mockImplementation(async path => ({
        data: path === '/account/two-factor' ? { enabled: false } : { success: false },
    }));
    api.put
        .mockResolvedValueOnce({ data: { challenge_id: challengeId, resend_after: 1 } })
        .mockResolvedValueOnce({ data: { enabled: false } });
    api.post
        .mockResolvedValueOnce({ data: { challenge_id: challengeId, resend_after: 60 } })
        .mockResolvedValueOnce({ data: { enabled: true } });
    renderAt('/profile', Profile, { email: accountEmail });

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on' }));
    const enablePassword = screen.getByLabelText('Current password');
    fireEvent.change(enablePassword, { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(api.put).toHaveBeenLastCalledWith('/account/two-factor', { enabled: true, password }, expect.objectContaining({ skipRetry: true }));

    const code = await screen.findByLabelText('Verification code');
    act(() => jest.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await screen.findByText('A new code was sent. Use the code from the latest email.');
    expect(api.post).toHaveBeenCalledWith('/account/two-factor/resend', {
        challenge_id: challengeId,
    }, expect.objectContaining({ skipRetry: true }));
    expect(screen.getByText('Off')).toBeInTheDocument();
    submitCode(code);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
    expect(api.post).toHaveBeenCalledWith('/account/two-factor/verify', {
        challenge_id: challengeId,
        code: '012345',
    }, expect.objectContaining({ skipRetry: true }));

    const disablePassword = screen.getByLabelText('Current password');
    fireEvent.change(disablePassword, { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByRole('button', { name: 'Turn on' })).toBeInTheDocument();
    expect(api.put).toHaveBeenLastCalledWith('/account/two-factor', { enabled: false, password }, expect.objectContaining({ skipRetry: true }));
});
