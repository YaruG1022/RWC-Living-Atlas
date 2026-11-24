import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import api from './api';
import Profile from './Profile';
import Reset from './Reset';

jest.mock('./api', () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: { success: false } });
    api.post.mockResolvedValue({ data: { success: true } });
});

function renderAt(path, component) {
    const history = createMemoryHistory({ initialEntries: [path] });
    render(<Router history={history}>{component}</Router>);
    return history;
}

test('a recovery link submits its token and removes it from the address', async () => {
    const history = renderAt('/reset-password#token=fixture-reset-token', <Reset />);
    expect(history.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText('New Password:'), { target: { value: 'demo-password' } });
    fireEvent.change(screen.getByLabelText('Confirm Password:'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(api.post).toHaveBeenCalledWith('/reset-password', {
        new_password: 'demo-password',
        reset_token: 'fixture-reset-token',
    }, { skipRetry: true });
});

test('an old link containing only an email asks for a new link', () => {
    renderAt('/reset-password?email=member%40example.invalid', <Reset />);
    expect(screen.getByRole('link', { name: 'request a new link' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Reset Password' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
});

test('changing a password uses the signed-in session and then signs out', async () => {
    const email = 'member@example.invalid';
    const otherAccount = { email: 'other@example.invalid' };
    localStorage.setItem('savedAccounts', JSON.stringify([{ email }, otherAccount]));
    const onLogout = jest.fn();
    const setMessage = jest.fn();
    const history = renderAt('/profile', <Profile email={email} onLogout={onLogout} setMessage={setMessage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    const field = screen.getByLabelText('New Password', { exact: true });
    fireEvent.change(field, { target: { value: 'demo-password' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'demo-password' } });
    fireEvent.submit(field.closest('form'));

    await waitFor(() => expect(history.location.pathname).toBe('/login'));
    expect(api.post).toHaveBeenCalledWith('/reset-password', { new_password: 'demo-password' }, { skipRetry: true });
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(setMessage).toHaveBeenCalledWith('Password changed. Sign in with your new password.');
    expect(JSON.parse(localStorage.getItem('savedAccounts'))).toEqual([otherAccount]);
});
