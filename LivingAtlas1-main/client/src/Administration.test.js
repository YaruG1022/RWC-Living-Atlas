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
    expect(screen.getByText('Showing 1 of 2 users')).toBeInTheDocument();
    userEvent.type(screen.getByRole('searchbox'), 'missing');
    expect(screen.getByText('No users match your search.')).toBeInTheDocument();
    userEvent.clear(screen.getByRole('searchbox'));
    userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'descending');
    expect(within(screen.getByText(admin.email).closest('tr')).getByRole('button', { name: 'Delete' })).toBeDisabled();
});

test('combines email search with role and sign-in filters and clears only the filters', async () => {
    const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const externalAdmin = { ...admin, email: 'admin@example.net', last_online_at: daysAgo(3) };
    const legacyAdmin = { ...admin, name: 'Legacy Admin', email: 'legacy@example.invalid', last_online_at: null };
    const recentMember = { ...member, last_online_at: daysAgo(15) };
    const olderMember = { ...member, name: 'Older Member', email: 'older@example.invalid', last_online_at: daysAgo(45) };
    api.post.mockResolvedValueOnce({ data: { users: [externalAdmin, legacyAdmin, recentMember, olderMember] } });
    render(<Administration />);
    await screen.findByText(externalAdmin.email);

    const role = screen.getByRole('combobox', { name: 'Role' });
    const lastSignIn = screen.getByRole('combobox', { name: 'Last sign-in' });
    const search = screen.getByRole('searchbox');
    userEvent.selectOptions(role, 'admin');
    userEvent.selectOptions(lastSignIn, '7');
    expect(screen.getByText('Showing 1 of 4 users')).toBeInTheDocument();
    expect(screen.getByText(externalAdmin.email)).toBeInTheDocument();

    userEvent.type(search, 'example.invalid');
    expect(screen.getByText('No users match your search and filters.')).toBeInTheDocument();
    userEvent.selectOptions(lastSignIn, 'missing');
    expect(screen.getByText(legacyAdmin.email)).toBeInTheDocument();

    userEvent.selectOptions(role, 'regular');
    userEvent.selectOptions(lastSignIn, '30');
    expect(screen.getByText(recentMember.email)).toBeInTheDocument();
    expect(screen.queryByText(olderMember.email)).not.toBeInTheDocument();
    userEvent.selectOptions(lastSignIn, 'older');
    expect(screen.getByText(olderMember.email)).toBeInTheDocument();
    expect(screen.queryByText(recentMember.email)).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('example.invalid');
    expect(screen.getByText('Showing 3 of 4 users')).toBeInTheDocument();
    expect(screen.queryByText(externalAdmin.email)).not.toBeInTheDocument();
});

test('shows recorded presence independently of sign-in time and combines it with other filters', async () => {
    const offlineAdmin = { ...admin, email: 'offline@example.invalid', presence_status: 'offline', last_online_at: new Date().toISOString() };
    const onlineUser = { ...member, presence_status: 'online', last_online_at: null };
    api.post.mockResolvedValueOnce({ data: { users: [offlineAdmin, onlineUser, admin] } });
    render(<Administration />);
    await screen.findByText(onlineUser.email);

    const onlineRow = within(screen.getByRole('row', { name: name => name.includes(onlineUser.email) }));
    expect(onlineRow.getByRole('cell', { name: 'Online' })).toBeInTheDocument();
    expect(onlineRow.getByRole('cell', { name: 'No sign-in recorded' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Offline' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Unknown' })).toBeInTheDocument();

    const setOnlineFilter = value => {
        userEvent.click(screen.getByRole('button', { name: /More filters/i }));
        const dialog = within(screen.getByRole('dialog', { name: 'Filter users' }));
        userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Online status' }), value);
        userEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));
    };
    setOnlineFilter('online');
    expect(screen.getByText('Showing 1 of 3 users')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More filters (1)' })).toBeInTheDocument();
    expect(screen.getByText(onlineUser.email)).toBeInTheDocument();
    userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'admin');
    expect(screen.getByText('Showing 0 of 3 users')).toBeInTheDocument();

    setOnlineFilter('offline');
    userEvent.selectOptions(screen.getByRole('combobox', { name: 'Last sign-in' }), '7');
    expect(screen.getByText(offlineAdmin.email)).toBeInTheDocument();
    expect(screen.queryByText(admin.email)).not.toBeInTheDocument();

    userEvent.selectOptions(screen.getByRole('combobox', { name: 'Last sign-in' }), 'any');
    setOnlineFilter('unknown');
    expect(screen.getByText(admin.email)).toBeInTheDocument();
    expect(screen.queryByText(offlineAdmin.email)).not.toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: 'Remove Online status filter: Unknown' }));
    expect(screen.getByText('Showing 2 of 3 users')).toBeInTheDocument();
});

test('applies a custom date joined range through the end of the selected local day', async () => {
    const users = [
        { ...admin, created_at: new Date(2025, 10, 1, 0, 0).toISOString() },
        { ...member, created_at: new Date(2025, 10, 2, 23, 59).toISOString() },
        { ...member, email: 'before@example.invalid', created_at: new Date(2025, 9, 31, 23, 59).toISOString() },
        { ...member, email: 'after@example.invalid', created_at: new Date(2025, 10, 3, 0, 0).toISOString() },
    ];
    api.post.mockResolvedValueOnce({ data: { users } });
    render(<Administration />);
    await screen.findByText(member.email);

    userEvent.click(screen.getByRole('button', { name: /More filters/i }));
    const dialog = within(screen.getByRole('dialog', { name: 'Filter users' }));
    userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Date joined' }), 'custom');
    fireEvent.change(dialog.getByLabelText('Start date'), { target: { value: '2025-11-01' } });
    fireEvent.change(dialog.getByLabelText('End date'), { target: { value: '2025-11-02' } });
    userEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 4 users')).toBeInTheDocument();
    expect(screen.getByText(admin.email)).toBeInTheDocument();
    expect(screen.getByText(member.email)).toBeInTheDocument();
    expect(screen.queryByText('before@example.invalid')).not.toBeInTheDocument();
    expect(screen.queryByText('after@example.invalid')).not.toBeInTheDocument();
});

test('applies mobile filter changes only when confirmed', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    api.post.mockResolvedValueOnce({ data: { users: [admin, { ...member, presence_status: 'online' }] } });
    try {
        render(<Administration />);
        await screen.findByText(member.email);
        expect(screen.queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument();
        const filterButton = screen.getByRole('button', { name: 'Filters' });
        userEvent.click(filterButton);
        let dialog = within(screen.getByRole('dialog', { name: 'Filter users' }));
        userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Role' }), 'admin');
        userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Online status' }), 'unknown');
        userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByText(member.email)).toBeInTheDocument();

        userEvent.click(filterButton);
        dialog = within(screen.getByRole('dialog', { name: 'Filter users' }));
        const role = dialog.getByRole('combobox', { name: 'Role' });
        const presence = dialog.getByRole('combobox', { name: 'Online status' });
        expect(role).toHaveValue('all');
        expect(presence).toHaveValue('any');
        userEvent.selectOptions(role, 'admin');
        userEvent.selectOptions(presence, 'unknown');
        userEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));
        expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeInTheDocument();
        expect(screen.queryByText(member.email)).not.toBeInTheDocument();
    } finally {
        window.matchMedia = originalMatchMedia;
    }
});

test('refreshes presence only in the visible users view and marks a failed update unavailable', async () => {
    jest.useFakeTimers();
    const visibility = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
        const onlineMember = { ...member, presence_status: 'online' };
        api.post.mockResolvedValueOnce({ data: { users: [admin, onlineMember] } });
        render(<Administration />);
        await screen.findByText(member.email);

        visibility.mockReturnValue(true);
        fireEvent(document, new Event('visibilitychange'));
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(api.post).toHaveBeenCalledTimes(1);

        api.post.mockRejectedValueOnce(new Error('network unavailable'));
        visibility.mockReturnValue(false);
        fireEvent(document, new Event('visibilitychange'));
        expect(await screen.findByText(/online status is temporarily unavailable/i)).toBeInTheDocument();
        expect(screen.getAllByRole('cell', { name: 'Unavailable' })).toHaveLength(2);
        expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();

        userEvent.click(screen.getByRole('button', { name: /More filters/i }));
        const dialog = within(screen.getByRole('dialog', { name: 'Filter users' }));
        userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Online status' }), 'offline');
        userEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));
        expect(screen.queryByText('Showing 0 of 2 users')).not.toBeInTheDocument();
        expect(screen.queryByText(/no users match/i)).not.toBeInTheDocument();

        const offlineMember = { ...member, presence_status: 'offline' };
        api.post.mockResolvedValueOnce({ data: { users: [admin, offlineMember] } });
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(screen.queryByText(/online status is temporarily unavailable/i)).not.toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'Offline' })).toBeInTheDocument();

        userEvent.click(screen.getByRole('button', { name: 'Statistics' }));
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(api.post).toHaveBeenCalledTimes(3);
    } finally {
        visibility.mockRestore();
        jest.useRealTimers();
    }
});

test('preserves concurrent user edits and restores focus when a live filter removes a row', async () => {
    jest.useFakeTimers();
    const visibility = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
        const onlineMember = { ...member, presence_status: 'online' };
        const retired = { name: 'Retired', email: 'retired@example.invalid', is_admin: false, presence_status: 'online' };
        api.post.mockResolvedValueOnce({ data: { users: [onlineMember, retired] } });
        render(<Administration />);
        await screen.findByText(member.email);

        userEvent.click(screen.getByRole('button', { name: /More filters/i }));
        const filters = within(screen.getByRole('dialog', { name: 'Filter users' }));
        userEvent.selectOptions(filters.getByRole('combobox', { name: 'Online status' }), 'online');
        userEvent.click(filters.getByRole('button', { name: 'Apply filters' }));

        let finishPoll;
        api.post.mockImplementationOnce(() => new Promise(resolve => { finishPoll = resolve; }));
        await act(async () => jest.advanceTimersByTime(30_000));

        const roleDialog = await openAction('Change Role');
        userEvent.click(within(roleDialog).getByRole('radio', { name: 'Admin' }));
        api.post.mockResolvedValueOnce({ data: { success: true } });
        confirm(roleDialog, 'Confirm Change');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        const deletion = await openAction('Delete', retired);
        api.post.mockResolvedValueOnce({ data: { success: true } });
        confirm(deletion, 'Confirm Delete');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        screen.getByRole('button', { name: 'Change Role' }).focus();

        await act(async () => finishPoll({ data: { users: [{ ...onlineMember, presence_status: 'offline' }, retired] } }));
        expect(screen.queryByText(member.email)).not.toBeInTheDocument();
        expect(screen.queryByText(retired.email)).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());

        userEvent.click(screen.getByRole('button', { name: 'Remove Online status filter: Online' }));
        expect(screen.getByText(member.email)).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'Admin' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'Offline' })).toBeInTheDocument();
        expect(screen.queryByText(retired.email)).not.toBeInTheDocument();
    } finally {
        visibility.mockRestore();
        jest.useRealTimers();
    }
});

test('keeps newer manual roster data when an earlier presence poll arrives late', async () => {
    jest.useFakeTimers();
    const visibility = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
        const onlineMember = { ...member, presence_status: 'online' };
        api.post.mockResolvedValueOnce({ data: { users: [onlineMember] } });
        render(<Administration />);
        await screen.findByText(member.email);

        let finishPoll;
        api.post.mockImplementationOnce(() => new Promise(resolve => { finishPoll = resolve; }));
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(api.post).toHaveBeenCalledTimes(2);

        const offlineAdmin = { ...member, is_admin: true, presence_status: 'offline' };
        api.post.mockResolvedValueOnce({ data: { users: [offlineAdmin] } });
        userEvent.click(screen.getByRole('button', { name: 'Refresh users' }));
        await screen.findByRole('cell', { name: 'Offline' });

        await act(async () => finishPoll({ data: { users: [onlineMember] } }));
        expect(screen.getByRole('cell', { name: 'Offline' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'Admin' })).toBeInTheDocument();
    } finally {
        visibility.mockRestore();
        jest.useRealTimers();
    }
});

test('sorts recorded sign-ins both ways and keeps missing and invalid timestamps last', async () => {
    const legacyEmail = 'legacy@example.invalid';
    const invalidEmail = 'invalid@example.invalid';
    const users = [
        { ...admin, last_online_at: '2025-09-01T12:00:00Z' },
        { ...member, last_online_at: '2025-11-01T12:00:00Z' },
        { ...member, email: legacyEmail, last_online_at: null },
        { ...member, email: invalidEmail, last_online_at: 'invalid date' },
    ];
    api.post.mockResolvedValueOnce({ data: { users } });
    render(<Administration />);
    await screen.findByText(member.email);

    const sortedEmails = () => screen.getAllByRole('cell', { name: /@example\.invalid$/ }).map(cell => cell.textContent);
    const column = screen.getByRole('columnheader', { name: 'Last sign-in' });
    const sort = within(column).getByRole('button', { name: 'Last sign-in' });
    expect(screen.queryByRole('columnheader', { name: /^(Status|Last Online)$/i })).not.toBeInTheDocument();

    userEvent.click(sort);
    expect(column).toHaveAttribute('aria-sort', 'descending');
    expect(sortedEmails().slice(0, 2)).toEqual([member.email, admin.email]);
    expect(sortedEmails().slice(2).sort()).toEqual([invalidEmail, legacyEmail]);

    userEvent.click(sort);
    expect(column).toHaveAttribute('aria-sort', 'ascending');
    expect(sortedEmails().slice(0, 2)).toEqual([admin.email, member.email]);
    expect(sortedEmails().slice(2).sort()).toEqual([invalidEmail, legacyEmail]);
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
    jest.useFakeTimers();
    const visibility = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
        api.post.mockResolvedValueOnce({ data: { error: 'Database unavailable' } });
        render(<Administration />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(api.post).toHaveBeenCalledTimes(1);

        userEvent.click(screen.getByRole('button', { name: 'Refresh users' }));
        await screen.findByText(member.email);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
        visibility.mockRestore();
        jest.useRealTimers();
    }
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
