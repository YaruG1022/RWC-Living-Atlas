import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Administration from './Administration';
import api from './api';

jest.mock('./api', () => ({ post: jest.fn() }));
const admin = { name: 'Admin', email: 'admin@example.invalid', is_admin: true };
const member = { name: 'Member', email: 'member+test#1@example.invalid', is_admin: false };

beforeEach(() => {
    localStorage.clear();
    api.post.mockReset();
    api.post.mockResolvedValue({ data: { users: [admin, member] } });
});

async function openAction(name, user = member) {
    await screen.findByText(user.email);
    userEvent.click(within(screen.getByText(user.email).closest('tr')).getByRole('button', { name }));
    return screen.getByRole('dialog');
}

function confirm(dialog, name) {
    userEvent.type(within(dialog).getByPlaceholderText('Confirm'), 'Confirm');
    userEvent.click(within(dialog).getByRole('button', { name }));
}

test('searches users, reports empty matches, and sorts accessibly', async () => {
    render(<Administration />);
    await screen.findByText(member.email);
    userEvent.type(screen.getByRole('searchbox'), 'MEMBER');
    expect(screen.queryByText(admin.email)).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 users')).toBeInTheDocument();
    userEvent.type(screen.getByRole('searchbox'), 'missing');
    expect(screen.getByText('No users match your search.')).toBeInTheDocument();
    userEvent.clear(screen.getByRole('searchbox'));
    userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'descending');
    expect(within(screen.getByText(admin.email).closest('tr')).getByRole('button', { name: 'Delete' })).toBeDisabled();
});

test('updates the selected role without refetching and restores focus', async () => {
    render(<Administration />);
    const dialog = await openAction('Change Role');
    userEvent.click(within(dialog).getByRole('radio', { name: 'Admin' }));
    api.post.mockResolvedValueOnce({ data: { success: true } });
    confirm(dialog, 'Confirm Change');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.post).toHaveBeenLastCalledWith('/edit_user_role', { email: member.email, is_admin: true }, { skipRetry: true });
    expect(within(screen.getByText(member.email).closest('tr')).getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(api.post.mock.calls.filter(([path]) => path === '/list_database')).toHaveLength(1);
    expect(within(screen.getByText(member.email).closest('tr')).getByRole('button', { name: 'Change Role' })).toHaveFocus();
});

test('validates confirmation and displays rejected role edits', async () => {
    render(<Administration />);
    const dialog = await openAction('Change Role');
    userEvent.click(within(dialog).getByRole('radio', { name: 'Admin' }));
    userEvent.click(within(dialog).getByRole('button', { name: 'Confirm Change' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Please type Confirm');
    expect(api.post).toHaveBeenCalledTimes(1);
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'The last admin must keep the Admin role.' } } });
    confirm(dialog, 'Confirm Change');
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('The last admin'));
    expect(screen.getByText(member.email)).toBeInTheDocument();
});

test('encodes email paths and prevents duplicate deletion or dismissal while pending', async () => {
    render(<Administration />);
    const dialog = await openAction('Delete');
    let finish;
    api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    confirm(dialog, 'Confirm Delete');
    expect(api.post).toHaveBeenLastCalledWith(`/delete_user/${encodeURIComponent(member.email)}`, null, { skipRetry: true });
    expect(within(dialog).getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape', keyCode: 27 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => finish({ data: { success: true } }));
    expect(screen.queryByText(member.email)).not.toBeInTheDocument();
    expect(screen.getByText('Member was deleted.')).toBeInTheDocument();
});

test('keeps legacy HTTP 200 delete errors visible and allows retry', async () => {
    render(<Administration />);
    const dialog = await openAction('Delete');
    api.post.mockResolvedValueOnce({ data: { error: 'This user still owns linked content.' } });
    confirm(dialog, 'Confirm Delete');
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('still owns linked content'));
    expect(screen.getByText(member.email)).toBeInTheDocument();
    api.post.mockResolvedValueOnce({ data: { success: true } });
    userEvent.click(within(dialog).getByRole('button', { name: 'Confirm Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('list failures are recoverable', async () => {
    api.post.mockResolvedValueOnce({ data: { error: 'Database unavailable' } });
    render(<Administration />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    userEvent.click(screen.getByRole('button', { name: 'Refresh users' }));
    await screen.findByText(member.email);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('syncs the current account role after self-demotion', async () => {
    const onCurrentRoleChange = jest.fn();
    render(<Administration currentEmail={admin.email} onCurrentRoleChange={onCurrentRoleChange} />);
    const dialog = await openAction('Change Role', admin);
    userEvent.click(within(dialog).getByRole('radio', { name: 'Regular User' }));
    api.post.mockResolvedValueOnce({ data: { success: true } });
    confirm(dialog, 'Confirm Change');
    await waitFor(() => expect(onCurrentRoleChange).toHaveBeenCalledWith(false));
    expect(localStorage.getItem('isAdmin')).toBe('false');
});
