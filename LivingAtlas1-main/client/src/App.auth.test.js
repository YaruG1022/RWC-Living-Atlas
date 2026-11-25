import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App from './App';
import api from './api';
import { storeSession } from './authSession';

jest.mock('./Navbar', () => () => <div>Navigation</div>);
jest.mock('./Main', () => () => null);
jest.mock('./Header', () => () => null);
jest.mock('./Home', () => () => <div>Home</div>);
jest.mock('./About', () => () => null);
jest.mock('./Contact', () => () => null);
jest.mock('./Login', () => () => <div>Login form</div>);
jest.mock('./Profile', () => () => <div>Profile page</div>);
jest.mock('./Signup', () => () => null);
jest.mock('./Administration', () => () => <div>Admin dashboard</div>);
jest.mock('./Reset', () => () => null);
jest.mock('./SwitchAccount', () => () => null);
jest.mock('./ChangelogHistory', () => () => null);
jest.mock('./UserManual', () => () => null);
jest.mock('./useSessionHeartbeat', () => jest.fn());

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/administration');
});

function saveAuth(overrides = {}) {
    Object.entries({ authStorageVersion: '2', isLoggedIn: 'true', isAdmin: 'true', email: 'admin@example.invalid', username: 'Admin', ...overrides }).forEach(([key, value]) => localStorage.setItem(key, value));
    storeSession('admin@example.invalid', 'test-session');
}

test('restores admin auth before guards and survives repeated reloads', () => {
    saveAuth();
    const first = render(<App />);
    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administration');
    first.unmount();
    render(<App />);
    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();
    expect(localStorage.getItem('email')).toBe('admin@example.invalid');
    expect(localStorage.getItem('isAdmin')).toBe('true');
});

test.each([{}, { isAdmin: 'false' }, { isLoggedIn: 'false' }, { authStorageVersion: '1' }])('rejects unauthorized or obsolete sessions: %j', overrides => {
    if (Object.keys(overrides).length) saveAuth(overrides);
    render(<App />);
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
});

test('restores profile routes without redirecting', () => {
    saveAuth({ isAdmin: 'false' });
    window.history.replaceState({}, '', '/profile');
    render(<App />);
    expect(screen.getByText('Profile page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/profile');
});

test.each([null, 'other@example.invalid'])('does not restore a cached account without a matching tab session: %s', sessionEmail => {
    saveAuth();
    sessionStorage.clear();
    if (sessionEmail) storeSession(sessionEmail, 'other-session');
    render(<App />);
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(localStorage.getItem('email')).toBe('admin@example.invalid');
    expect(localStorage.getItem('isLoggedIn')).toBe('true');
});

test('a rejected card request signs the current tab out', async () => {
    saveAuth();
    render(<App />);
    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();

    await act(async () => {
        await expect(api.delete('/deleteCard', {
            adapter: config => Promise.reject({ config, response: { status: 401 } }),
        })).rejects.toMatchObject({ response: { status: 401 } });
    });
    expect(screen.getByText('Login form')).toBeInTheDocument();
});

test('a different account signing in elsewhere leaves this tab signed out', () => {
    saveAuth();
    render(<App />);
    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();

    act(() => {
        localStorage.setItem('email', 'other@example.invalid');
        window.dispatchEvent(new StorageEvent('storage', { key: 'email', storageArea: localStorage }));
    });
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(localStorage.getItem('email')).toBe('other@example.invalid');
});
