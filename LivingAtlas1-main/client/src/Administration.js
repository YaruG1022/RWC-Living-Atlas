import React, { useState, useEffect } from 'react';
import api from './api.js';
import './Administration.css';
import InfoPage from './InfoPage';
import './AccountPage.css';

function Administration() {
    const [users, setUsers] = useState([]);
    const [signUpRequests, setSignUpRequests] = useState([]);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('statistics');
    const [roleModalUser, setRoleModalUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('regular');
    const [roleConfirmText, setRoleConfirmText] = useState('');
    const [roleModalError, setRoleModalError] = useState('');
    const [isRoleUpdating, setIsRoleUpdating] = useState(false);
    const [deleteModalUser, setDeleteModalUser] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteModalError, setDeleteModalError] = useState('');
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    const currentEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
    const isCurrentUserLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    const getUserOnlineState = (user) => {
        if (typeof user?.is_online === 'boolean') return user.is_online;
        if (typeof user?.online === 'boolean') return user.online;
        if (typeof user?.status === 'string') {
            return user.status.trim().toLowerCase() === 'online';
        }
        const userEmail = (user?.email || '').trim().toLowerCase();
        return isCurrentUserLoggedIn && userEmail !== '' && userEmail === currentEmail;
    };

    const formatJoinedDate = (rawDate) => {
        if (!rawDate) return 'N/A';
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatLastOnline = (rawDate) => {
        if (!rawDate) return 'N/A';
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-US', {
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
            setSortOrder('asc');
        }
    };

    const getSortedUsers = () => {
        const sorted = [...users];
        sorted.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name') {
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
            } else if (sortBy === 'date_joined') {
                aVal = new Date(a.created_at || 0).getTime();
                bVal = new Date(b.created_at || 0).getTime();
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    };

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
        try {
            const response = await api.post('/list_database');
            setUsers(response.data.users);
        } catch (error) {
            setError(error.message);
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
        if (!deleteModalUser) {
            return;
        }

        if (deleteConfirmText !== 'Confirm') {
            setDeleteModalError('Please type Confirm exactly to proceed.');
            return;
        }

        try {
            setIsDeletingUser(true);
            setDeleteModalError('');
            await api.post(`/delete_user/${deleteModalUser.email}`);
            const response = await api.post('/list_database');
            setUsers(response.data.users);
            handleCloseDeleteModal();
        } catch (error) {
            setError(error.message);
            setDeleteModalError(error.message);
        } finally {
            setIsDeletingUser(false);
        }
    };

    const handleOpenDeleteModal = (user) => {
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

    const handleOpenRoleModal = (user) => {
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
        if (!roleModalUser) {
            return;
        }

        if (roleConfirmText !== 'Confirm') {
            setRoleModalError('Please type Confirm exactly to proceed.');
            return;
        }

        try {
            setIsRoleUpdating(true);
            setRoleModalError('');
            await api.post('/edit_user_role', {
                email: roleModalUser.email,
                is_admin: selectedRole === 'admin'
            });
            const response = await api.post('/list_database');
            setUsers(response.data.users);
            handleCloseRoleModal();
        } catch (error) {
            setError(error.message);
            setRoleModalError(error.message);
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
                    {error && <p className="admin-error">Error: {error}</p>}
                    <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th
                                    className="admin-table-header-sortable"
                                    onClick={() => handleSortChange('name')}
                                    title="Click to sort"
                                >
                                    <span className="admin-sort-header-content">
                                        Name
                                        {renderSortIndicator('name')}
                                    </span>
                                </th>
                                <th>Email</th>
                                <th
                                    className="admin-table-header-sortable"
                                    onClick={() => handleSortChange('date_joined')}
                                    title="Click to sort"
                                >
                                    <span className="admin-sort-header-content">
                                        Date Joined
                                        {renderSortIndicator('date_joined')}
                                    </span>
                                </th>
                                <th>Status</th>
                                <th>Last Online</th>
                                <th>Role</th>
                                <th>Edit</th>
                                <th>Delete</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getSortedUsers().map(user => (
                                <tr key={user.email}>
                                    <td>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>{formatJoinedDate(user.created_at)}</td>
                                    <td>
                                        <span className={`admin-status ${getUserOnlineState(user) ? 'admin-status-online' : 'admin-status-offline'}`}>
                                            <span className="admin-status-dot" aria-hidden="true" />
                                            {getUserOnlineState(user) ? 'Online' : 'Offline'}
                                        </span>
                                    </td>
                                    <td>{formatLastOnline(user.last_online_at)}</td>
                                    <td>
                                        <span className={`admin-badge ${user.is_admin ? 'admin-badge-admin' : 'admin-badge-user'}`}>
                                            {user.is_admin ? 'Admin' : 'Regular User'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="admin-action-btn account-button account-button--secondary" onClick={() => handleOpenRoleModal(user)}>
                                            Change Role
                                        </button>
                                    </td>
                                    {!user.is_admin ? (
                                        <td>
                                            <button className="admin-action-btn admin-action-btn-danger account-button account-button--danger" onClick={() => handleOpenDeleteModal(user)}>
                                                Delete
                                            </button>
                                        </td>
                                    ) : (
                                        <td className="admin-muted">-</td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
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
                <div className="admin-modal-overlay" onClick={handleCloseRoleModal}>
                    <div className="admin-modal account-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-role-title" onClick={(event) => event.stopPropagation()}>
                        <h2 id="admin-role-title" className="admin-modal-title">Change User Role</h2>
                        <p className="admin-modal-subtitle">
                            {roleModalUser.name} ({roleModalUser.email})
                        </p>

                        <div className="admin-role-options">
                            <label className="admin-role-option">
                                <input
                                    type="radio"
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
                            id="admin-role-confirm-input"
                            className="admin-confirm-input account-control"
                            type="text"
                            value={roleConfirmText}
                            onChange={(event) => setRoleConfirmText(event.target.value)}
                            placeholder="Confirm"
                        />

                        {roleModalError && <p className="admin-error admin-modal-error">{roleModalError}</p>}

                        <div className="admin-modal-actions">
                            <button className="admin-action-btn account-button account-button--secondary" onClick={handleCloseRoleModal}>
                                Cancel
                            </button>
                            <button
                                className="admin-action-btn admin-action-btn-approve account-button"
                                onClick={handleEditUserRole}
                                disabled={isRoleUpdating}
                            >
                                {isRoleUpdating ? 'Updating...' : 'Confirm Change'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteModalUser && (
                <div className="admin-modal-overlay" onClick={handleCloseDeleteModal}>
                    <div className="admin-modal account-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title" onClick={(event) => event.stopPropagation()}>
                        <h2 id="admin-delete-title" className="admin-modal-title">Delete User</h2>
                        <p className="admin-modal-subtitle">
                            {deleteModalUser.name} ({deleteModalUser.email})
                        </p>

                        <label className="admin-confirm-label" htmlFor="admin-delete-confirm-input">
                            Type <strong>Confirm</strong> to delete this user
                        </label>
                        <input
                            id="admin-delete-confirm-input"
                            className="admin-confirm-input account-control"
                            type="text"
                            value={deleteConfirmText}
                            onChange={(event) => setDeleteConfirmText(event.target.value)}
                            placeholder="Confirm"
                        />

                        {deleteModalError && <p className="admin-error admin-modal-error">{deleteModalError}</p>}

                        <div className="admin-modal-actions">
                            <button className="admin-action-btn account-button account-button--secondary" onClick={handleCloseDeleteModal}>
                                Cancel
                            </button>
                            <button
                                className="admin-action-btn admin-action-btn-danger account-button account-button--danger"
                                onClick={handleDeleteUser}
                                disabled={isDeletingUser}
                            >
                                {isDeletingUser ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </InfoPage>
    );
}

export default Administration;
