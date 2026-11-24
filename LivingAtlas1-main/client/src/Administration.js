import React, { useState, useEffect, useRef } from 'react';
import api from './api.js';
import Modal from 'react-modal';
import './Administration.css';
import InfoPage from './InfoPage';
import './AccountPage.css';
import AdminUserFilters, { DEFAULT_USER_FILTERS, hasUserFilters } from './AdminUserFilters';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_SORT_FIELDS = { date_joined: 'created_at', last_sign_in: 'last_online_at' };

function dateTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

function joinedDateBounds(filters, now) {
    if (filters.dateJoined === 'any') return null;
    if (filters.dateJoined === 'custom') {
        const until = new Date(dateTimestamp(filters.endDate));
        until.setDate(until.getDate() + 1);
        return [dateTimestamp(filters.startDate), until.getTime()];
    }
    const today = new Date(now);
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    return [
        new Date(year, month, day - Number(filters.dateJoined) + 1).getTime(),
        new Date(year, month, day + 1).getTime(),
    ];
}

function matchesLastSignIn(value, range, now) {
    if (range === 'any') return true;
    const timestamp = dateTimestamp(value);
    if (range === 'missing') return timestamp === null;
    if (timestamp === null) return false;
    if (range === 'older') return timestamp < now - 30 * DAY_MS;
    return timestamp >= now - Number(range) * DAY_MS && timestamp <= now;
}

function managementError(error) {
    return error.response?.data?.detail || error.response?.data?.error || error.message || 'Please try again.';
}

function checkManagementResponse(response) {
    if (response.data?.error || response.data?.success === false) {
        throw new Error(response.data.error || response.data.message || 'The request failed.');
    }
    return response.data;
}

function Administration({ currentEmail: accountEmail, onCurrentRoleChange = () => {} }) {
    const [users, setUsers] = useState([]);
    const [signUpRequests, setSignUpRequests] = useState([]);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('manage-users');
    const [roleModalUser, setRoleModalUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('regular');
    const [roleConfirmText, setRoleConfirmText] = useState('');
    const [roleModalError, setRoleModalError] = useState('');
    const [isRoleUpdating, setIsRoleUpdating] = useState(false);
    const [deleteModalUser, setDeleteModalUser] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteModalError, setDeleteModalError] = useState('');
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [search, setSearch] = useState('');
    const [userFilters, setUserFilters] = useState(DEFAULT_USER_FILTERS);
    const [notice, setNotice] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const userSearch = useRef(null);
    const userActionTrigger = useRef(null);

    const currentEmail = (accountEmail || localStorage.getItem('email') || '').trim().toLowerCase();

    const formatJoinedDate = (rawDate) => {
        const timestamp = dateTimestamp(rawDate);
        if (timestamp === null) return 'N/A';
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatLastSignIn = (rawDate) => {
        const timestamp = dateTimestamp(rawDate);
        if (timestamp === null) return 'No sign-in recorded';
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handleSortChange = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder(column === 'last_sign_in' ? 'desc' : 'asc');
        }
    };

    const getSortedUsers = () => {
        const query = search.trim().toLowerCase();
        const now = Date.now();
        const joinedBounds = joinedDateBounds(userFilters, now);
        const sorted = users.filter(user => {
            if (!`${user.name || ''} ${user.email || ''}`.toLowerCase().includes(query)) return false;
            if (userFilters.role !== 'all' && Boolean(user.is_admin) !== (userFilters.role === 'admin')) return false;
            if (!matchesLastSignIn(user.last_online_at, userFilters.lastSignIn, now)) return false;
            if (!joinedBounds) return true;
            const joined = dateTimestamp(user.created_at);
            return joined !== null && joined >= joinedBounds[0] && joined < joinedBounds[1];
        });
        const dateField = DATE_SORT_FIELDS[sortBy];
        sorted.sort((a, b) => {
            const aVal = dateField ? dateTimestamp(a[dateField]) : (a.name || '').toLowerCase();
            const bVal = dateField ? dateTimestamp(b[dateField]) : (b.name || '').toLowerCase();
            if (aVal !== bVal) {
                if (aVal === null) return 1;
                if (bVal === null) return -1;
                return (aVal < bVal ? -1 : 1) * (sortOrder === 'asc' ? 1 : -1);
            }
            return (a.email || '').localeCompare(b.email || '');
        });
        return sorted;
    };

    const renderSortableHeader = (column, label) => (
        <th
            scope="col"
            className="admin-table-header-sortable"
            aria-sort={sortBy === column ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
        >
            <button type="button" className="admin-sort-header-content" onClick={() => handleSortChange(column)}>
                {label}
                {renderSortIndicator(column)}
            </button>
        </th>
    );

    const renderSortIndicator = (column) => {
        const direction = sortBy === column ? sortOrder : null;
        return (
            <span className="admin-sort-indicator" aria-hidden="true">
                <span className={`admin-sort-triangle admin-sort-triangle-up ${direction === 'asc' ? 'is-active' : 'is-inactive'}`} />
                <span className={`admin-sort-triangle admin-sort-triangle-down ${direction === 'desc' ? 'is-active' : 'is-inactive'}`} />
            </span>
        );
    };

    useEffect(() => {
        if (activeTab === 'manage-users') {
            fetchUsers();
        } else if (activeTab === 'sign-up-requests') {
            fetchSignUpRequests();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        setError(null);
        try {
            const data = checkManagementResponse(await api.post('/list_database'));
            if (!Array.isArray(data.users)) throw new Error('Unable to load users. Please try again.');
            setUsers(data.users);
        } catch (error) {
            setError(managementError(error));
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const fetchSignUpRequests = async () => {
        try {
            const response = await api.post('/fetch_signup_requests');
            setSignUpRequests(response.data.signUpRequests);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteModalUser || isDeletingUser) {
            return;
        }

        if (deleteConfirmText !== 'Confirm') {
            setDeleteModalError('Please type Confirm exactly to proceed.');
            return;
        }

        try {
            setIsDeletingUser(true);
            setDeleteModalError('');
            checkManagementResponse(await api.post(`/delete_user/${encodeURIComponent(deleteModalUser.email)}`, null, { skipRetry: true }));
            setUsers(previous => previous.filter(user => user.email !== deleteModalUser.email));
            setNotice(`${deleteModalUser.name || deleteModalUser.email} was deleted.`);
            handleCloseDeleteModal();
        } catch (error) {
            setDeleteModalError(managementError(error));
        } finally {
            setIsDeletingUser(false);
        }
    };

    const handleOpenDeleteModal = (user, trigger) => {
        userActionTrigger.current = trigger;
        setNotice('');
        setDeleteModalUser(user);
        setDeleteConfirmText('');
        setDeleteModalError('');
    };

    const handleCloseDeleteModal = () => {
        setDeleteModalUser(null);
        setDeleteConfirmText('');
        setDeleteModalError('');
        setIsDeletingUser(false);
    };
    
    const handleDenyRequest = async (request) => {
        // Placeholder function for denying a sign-up request
        console.log("Denying sign-up request:", request);
        try {
            await api.post(`/deny_request/${request.email}`);
            const response = await api.post('/fetch_signup_requests');
            setSignUpRequests(response.data.signUpRequests);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleOpenRoleModal = (user, trigger) => {
        userActionTrigger.current = trigger;
        setNotice('');
        setRoleModalUser(user);
        setSelectedRole(user.is_admin ? 'admin' : 'regular');
        setRoleConfirmText('');
        setRoleModalError('');
    };

    const handleCloseRoleModal = () => {
        setRoleModalUser(null);
        setRoleConfirmText('');
        setRoleModalError('');
        setIsRoleUpdating(false);
    };

    const handleEditUserRole = async () => {
        if (!roleModalUser || isRoleUpdating) {
            return;
        }

        if (roleConfirmText !== 'Confirm') {
            setRoleModalError('Please type Confirm exactly to proceed.');
            return;
        }

        try {
            setIsRoleUpdating(true);
            setRoleModalError('');
            const isAdmin = selectedRole === 'admin';
            checkManagementResponse(await api.post('/edit_user_role', {
                email: roleModalUser.email,
                is_admin: isAdmin,
            }, { skipRetry: true }));
            setUsers(previous => previous.map(user => user.email === roleModalUser.email ? { ...user, is_admin: isAdmin } : user));
            setNotice(`Role updated for ${roleModalUser.name || roleModalUser.email}.`);
            handleCloseRoleModal();
            if (roleModalUser.email.trim().toLowerCase() === currentEmail) {
                localStorage.setItem('isAdmin', JSON.stringify(isAdmin));
                onCurrentRoleChange(isAdmin);
            }
        } catch (error) {
            setRoleModalError(managementError(error));
        } finally {
            setIsRoleUpdating(false);
        }
    };

    const handleApproveRequest = async (request) => {
        try {
            const formData = new FormData();
            formData.append('name', request.name);
            formData.append('email', request.email);
            formData.append('password', request.password);
    
            // Call the uploadAccount endpoint to add the user
            const response = await api.post('/uploadAccount', formData, {
                headers: {
                  'Content-Type': 'multipart/form-data'
                }
            });
            console.log(response.data); // Log the response from the server

            if (!response.data?.success) {
                setError(response.data?.message || 'Failed to approve sign-up request.');
                return;
            }

            // Respect requested access level chosen in register page.
            if (request.desired_access_level) {
                await api.post('/edit_user_role', { email: request.email, is_admin: true });
            }
    
            // Remove the approved request from the sign-up requests list
            const updatedRequests = signUpRequests.filter(req => req.email !== request.email);
            setSignUpRequests(updatedRequests);
    
            // After successfully adding the user, send a request to delete the request from the database
            await api.post(`/deny_request/${request.email}`);
            

        } catch (error) {
            setError(error.message);
        }
    };
    
    

    

    const hasFilters = hasUserFilters(userFilters);
    const hasSearch = Boolean(search.trim());
    const visibleUsers = activeTab === 'manage-users' ? getSortedUsers() : [];
    const emptyUserList = !error && users.length > 0 && (hasSearch || hasFilters);
    const resetSearchAndFilters = () => {
        setSearch('');
        setUserFilters(DEFAULT_USER_FILTERS);
        userSearch.current?.focus();
    };
    const restoreUserActionFocus = () => {
        const trigger = userActionTrigger.current;
        // The dialog can close before React removes the row from the DOM.
        window.requestAnimationFrame(() => {
            if (!trigger?.isConnected && document.activeElement === document.body) {
                userSearch.current?.focus();
            }
        });
    };

    return (
        <InfoPage title="Administration" className="admin-page account-page">

            <nav className="admin-nav-tabs account-tabs" aria-label="Administration sections">
                <button
                    className={`admin-nav-tab account-tab${activeTab === 'statistics' ? ' active' : ''}`}
                    onClick={() => setActiveTab('statistics')}
                >
                    Statistics
                </button>
                <button
                    className={`admin-nav-tab account-tab${activeTab === 'manage-users' ? ' active' : ''}`}
                    onClick={() => setActiveTab('manage-users')}
                >
                    Manage Users
                </button>
                <button
                    className={`admin-nav-tab account-tab${activeTab === 'sign-up-requests' ? ' active' : ''}`}
                    onClick={() => setActiveTab('sign-up-requests')}
                >
                    Sign Up Requests
                </button>
            </nav>

            {activeTab === 'statistics' && (
                <section className="admin-card account-panel">
                    <h2 className="admin-section-title account-section-title">Statistics</h2>
                    <p className="admin-stats-placeholder">Statistics will be available here in a future update.</p>
                </section>
            )}

            {activeTab === 'manage-users' && (
                <section className="admin-card account-panel">
                    <h2 className="admin-section-title account-section-title">User Management</h2>
                    {error && <p className="admin-error" role="alert">{error}</p>}
                    {notice && <p className="admin-notice" role="status">{notice}</p>}
                    <AdminUserFilters
                        search={search}
                        searchRef={userSearch}
                        setSearch={setSearch}
                        filters={userFilters}
                        setFilters={setUserFilters}
                        onRefresh={fetchUsers}
                        isLoading={isLoadingUsers}
                        listAvailable={!error || users.length > 0}
                        total={users.length}
                        matches={visibleUsers.length}
                    />
                    <div className="admin-table-wrap" role="region" aria-label="Users table" tabIndex={0} aria-busy={isLoadingUsers}>
                        <table className="admin-table admin-users-table">
                            <thead>
                                <tr>
                                    {renderSortableHeader('name', 'Name')}
                                    <th scope="col">Email</th>
                                    <th scope="col">Role</th>
                                    {renderSortableHeader('date_joined', 'Date joined')}
                                    {renderSortableHeader('last_sign_in', 'Last sign-in')}
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleUsers.map(user => (
                                    <tr key={user.email}>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`admin-badge ${user.is_admin ? 'admin-badge-admin' : 'admin-badge-user'}`}>
                                                {user.is_admin ? 'Admin' : 'Regular User'}
                                            </span>
                                        </td>
                                        <td>{formatJoinedDate(user.created_at)}</td>
                                        <td>{formatLastSignIn(user.last_online_at)}</td>
                                        <td>
                                            <div className="admin-actions-inline">
                                                <button type="button" className="admin-action-btn account-button account-button--secondary" onClick={event => handleOpenRoleModal(user, event.currentTarget)}>
                                                    Change Role
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-action-btn admin-action-btn-danger account-button account-button--danger"
                                                    disabled={user.is_admin}
                                                    title={user.is_admin ? 'Change this admin to Regular User before deleting.' : undefined}
                                                    onClick={event => handleOpenDeleteModal(user, event.currentTarget)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!isLoadingUsers && visibleUsers.length === 0 && (
                        <div className="admin-empty-state admin-user-empty">
                            {error ? 'User list unavailable. Use Refresh users to retry.' : emptyUserList ? (
                                <>
                                    <span>{hasFilters ? 'No users match your search and filters.' : 'No users match your search.'}</span>
                                    <button type="button" className="account-link" onClick={resetSearchAndFilters}>Reset search and filters</button>
                                </>
                            ) : 'No users found.'}
                        </div>
                    )}
                </section>
            )}

            {activeTab === 'sign-up-requests' && (
                <section className="admin-card account-panel">
                    <h2 className="admin-section-title account-section-title">Sign Up Requests</h2>
                    {error && <p className="admin-error">Error: {error}</p>}
                    {signUpRequests.length === 0 ? (
                        <p className="admin-empty-state">No sign-up requests.</p>
                    ) : (
                    <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Message</th>
                                <th>Desired Level of Access</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signUpRequests.map(request => (
                                <tr key={request.email}>
                                    <td>{request.name}</td>
                                    <td>{request.email}</td>
                                    <td>{request.sponsor_message}</td>
                                    <td>
                                        <span className={`admin-badge ${request.desired_access_level ? 'admin-badge-admin' : 'admin-badge-user'}`}>
                                            {request.desired_access_level ? 'Admin' : 'Regular User'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="admin-actions-inline">
                                            <button className="admin-action-btn admin-action-btn-approve account-button" onClick={() => handleApproveRequest(request)}>
                                                Approve
                                            </button>
                                            <button className="admin-action-btn admin-action-btn-danger account-button account-button--danger" onClick={() => handleDenyRequest(request)}>
                                                Deny
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                    )}
                </section>
            )}

            {roleModalUser && (
                <Modal
                    isOpen
                    overlayClassName="admin-modal-overlay admin-page"
                    className="admin-modal account-dialog"
                    aria={{ labelledby: 'admin-role-title', modal: true }}
                    ariaHideApp={!!document.getElementById('root')}
                    appElement={document.getElementById('root') || undefined}
                    onRequestClose={handleCloseRoleModal}
                    onAfterClose={restoreUserActionFocus}
                    shouldCloseOnOverlayClick={!isRoleUpdating}
                    shouldCloseOnEsc={!isRoleUpdating}
                >
                    <form onSubmit={event => { event.preventDefault(); handleEditUserRole(); }}>
                        <h2 id="admin-role-title" className="admin-modal-title">Change User Role</h2>
                        <p className="admin-modal-subtitle">
                            {roleModalUser.name} ({roleModalUser.email})
                        </p>

                        <div className="admin-role-options">
                            <label className="admin-role-option">
                                <input
                                    type="radio"
                                    disabled={isRoleUpdating}
                                    name="role"
                                    value="regular"
                                    checked={selectedRole === 'regular'}
                                    onChange={(event) => setSelectedRole(event.target.value)}
                                />
                                Regular User
                            </label>
                            <label className="admin-role-option">
                                <input
                                    type="radio"
                                    disabled={isRoleUpdating}
                                    name="role"
                                    value="admin"
                                    checked={selectedRole === 'admin'}
                                    onChange={(event) => setSelectedRole(event.target.value)}
                                />
                                Admin
                            </label>
                        </div>

                        <label className="admin-confirm-label" htmlFor="admin-role-confirm-input">
                            Type <strong>Confirm</strong> to apply this role change
                        </label>
                        <input
                            autoFocus
                            disabled={isRoleUpdating}
                            id="admin-role-confirm-input"
                            className="admin-confirm-input account-control"
                            type="text"
                            value={roleConfirmText}
                            onChange={(event) => setRoleConfirmText(event.target.value)}
                            placeholder="Confirm"
                        />

                        {roleModalError && <p className="admin-error admin-modal-error" role="alert">{roleModalError}</p>}

                        <div className="admin-modal-actions">
                            <button className="admin-action-btn account-button account-button--secondary" type="button" disabled={isRoleUpdating} onClick={handleCloseRoleModal}>
                                Cancel
                            </button>
                            <button
                                className="admin-action-btn admin-action-btn-approve account-button"
                                type="submit"
                                disabled={isRoleUpdating || selectedRole === (roleModalUser.is_admin ? 'admin' : 'regular')}
                            >
                                {isRoleUpdating ? 'Updating...' : 'Confirm Change'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {deleteModalUser && (
                <Modal
                    isOpen
                    overlayClassName="admin-modal-overlay admin-page"
                    className="admin-modal account-dialog"
                    aria={{ labelledby: 'admin-delete-title', modal: true }}
                    ariaHideApp={!!document.getElementById('root')}
                    appElement={document.getElementById('root') || undefined}
                    onRequestClose={handleCloseDeleteModal}
                    onAfterClose={restoreUserActionFocus}
                    shouldCloseOnOverlayClick={!isDeletingUser}
                    shouldCloseOnEsc={!isDeletingUser}
                >
                    <form onSubmit={event => { event.preventDefault(); handleDeleteUser(); }}>
                        <h2 id="admin-delete-title" className="admin-modal-title">Delete User</h2>
                        <p className="admin-modal-subtitle">
                            {deleteModalUser.name} ({deleteModalUser.email})
                        </p>

                        <p className="admin-modal-subtitle">This permanently removes the account. Users with linked content must have that content reassigned or removed first.</p>
                        <label className="admin-confirm-label" htmlFor="admin-delete-confirm-input">
                            Type <strong>Confirm</strong> to delete this user
                        </label>
                        <input
                            autoFocus
                            disabled={isDeletingUser}
                            id="admin-delete-confirm-input"
                            className="admin-confirm-input account-control"
                            type="text"
                            value={deleteConfirmText}
                            onChange={(event) => setDeleteConfirmText(event.target.value)}
                            placeholder="Confirm"
                        />

                        {deleteModalError && <p className="admin-error admin-modal-error" role="alert">{deleteModalError}</p>}

                        <div className="admin-modal-actions">
                            <button className="admin-action-btn account-button account-button--secondary" type="button" disabled={isDeletingUser} onClick={handleCloseDeleteModal}>
                                Cancel
                            </button>
                            <button
                                className="admin-action-btn admin-action-btn-danger account-button account-button--danger"
                                type="submit"
                                disabled={isDeletingUser}
                            >
                                {isDeletingUser ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </InfoPage>
    );
}

export default Administration;
