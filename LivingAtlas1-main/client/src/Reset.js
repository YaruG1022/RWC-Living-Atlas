import React, { useState, useEffect } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import api from './api';

const Reset = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const location = useLocation();
    const history = useHistory();
    const [resetToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'));
    const [isResetting, setIsResetting] = useState(false);
    const [resetSucceeded, setResetSucceeded] = useState(false);

    useEffect(() => {
        if (resetToken && location.hash) {
            history.replace({ pathname: location.pathname, search: location.search });
        }
    }, [history, location.hash, location.pathname, location.search, resetToken]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!resetToken || isResetting || resetSucceeded) return;

        if (newPassword !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        if (newPassword.length < 6) {
            setMessage("Password must be at least 6 characters long.");
            return;
        }

        setIsResetting(true);
        setMessage('');
        try {
            const response = await api.post('/reset-password', {
                new_password: newPassword,
                reset_token: resetToken
            }, { skipRetry: true });
            if (response.data?.success) {
                setResetSucceeded(true);
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setMessage("Could not reset your password. Please try again.");
            }
        } catch (error) {
            setMessage(error.response?.status === 401
                ? "This reset link has expired or already been used. Request a new link from the login page."
                : "Could not reset your password. Please try again.");
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Reset Password</h2>
            {!resetToken && (
                <p>Use the link from your password reset email or <Link to="/login">request a new link</Link>.</p>
            )}
            {resetSucceeded && (
                <p role="status">Password reset. <Link to="/login">Sign in</Link> with your new password.</p>
            )}
            {resetToken && !resetSucceeded && (
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="newPassword">New Password:</label>
                        <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength="6"
                            autoComplete="new-password"
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                            placeholder="Enter new password (min 6 characters)"
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="confirmPassword">Confirm Password:</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength="6"
                            autoComplete="new-password"
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                            placeholder="Confirm new password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isResetting}
                        style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        {isResetting ? 'Resetting password...' : 'Reset Password'}
                    </button>
                </form>
            )}
            {message && (
                <p role="alert" style={{
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px'
                }}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default Reset;
