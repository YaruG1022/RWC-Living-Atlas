import React, { useState, useEffect, useRef } from 'react';
import { Link, useHistory } from 'react-router-dom';
import InfoPage from './InfoPage';
import './AccountPage.css';
import './Login.css';
import api, { signOutSession } from './api.js';
import { storeSession } from './authSession';

function normalizeAdminFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return ['true', '1', 't', 'yes', 'y', 'admin'].includes(normalized);
    }
    return false;
}

function Login({ email, setEmail, password, setPassword, message, setMessage, isLoggedIn, setIsLoggedIn, username, setUsername, setIsAdmin }) {
    const [submitemail, setsubmitEmail] = useState('');
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
    const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
    const [redirectCountdown, setRedirectCountdown] = useState(null);
    const countdownRef = useRef(null);
    const history = useHistory();

    // Cancel redirect if user navigates away manually
    useEffect(() => {
        const unlisten = history.listen(() => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
                setRedirectCountdown(null);
            }
        });
        return () => {
            unlisten();
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, [history]);

    const handleLogin = (e) => {
        e.preventDefault();

        api.post('/profileAccount', { email: submitemail, password }, { skipRetry: true })
        .then((response) => {
            const accountData = response.data['Account Information'];
            const token = response.data.session_token;
            if (accountData?.length && token) {
                const [name, email, rawIsAdmin] = accountData[0];
                const resolvedIsAdmin = normalizeAdminFlag(rawIsAdmin);

                setIsLoggedIn(true);
                setMessage('Successfully logged in!');

                // Countdown redirect (3 → 2 → 1)
                setRedirectCountdown(3);
                let count = 3;
                countdownRef.current = setInterval(() => {
                    count -= 1;
                    if (count <= 0) {
                        clearInterval(countdownRef.current);
                        countdownRef.current = null;
                        setRedirectCountdown(null);
                        history.push('/');
                    } else {
                        setRedirectCountdown(count);
                    }
                }, 1000);

                setUsername(name);
                setEmail(email);
                setIsAdmin(resolvedIsAdmin);

                // Persist login data in localStorage for immediate consistency.
                localStorage.setItem('isLoggedIn', JSON.stringify(true));
                localStorage.setItem('email', email);
                localStorage.setItem('username', name);
                localStorage.setItem('isAdmin', JSON.stringify(resolvedIsAdmin));
                storeSession(email, token);

                // Save account to savedAccounts for Switch Account feature
                const savedAccounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
                const existingIdx = savedAccounts.findIndex(a => a.email === email);
                const accountEntry = { email, username: name, password };
                if (existingIdx >= 0) {
                  savedAccounts[existingIdx] = accountEntry;
                } else {
                  savedAccounts.push(accountEntry);
                }
                localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
            } else {
                setMessage('Invalid email or password.');
            }
        })
        .catch(error => {
            setMessage(error.response?.status === 401 ? 'Invalid email or password.' : 'Error during login. Please try again.');
        });
    };

    const handleLogout = () => {
        signOutSession();
        setIsLoggedIn(false);
        setEmail('');
        setsubmitEmail('');
        setPassword('');
        setMessage('Successfully logged out.');
        setUsername("You're logged out.");

        // Clear auth data from localStorage
        localStorage.setItem('isLoggedIn', JSON.stringify(false));
        localStorage.setItem('email', '');
        localStorage.setItem('username', '');
        localStorage.setItem('isAdmin', JSON.stringify(false));
    };

    const handleForgotPasswordSubmit = (e) => {
        e.preventDefault();
        console.log('DEBUG: Forgot password form submitted');
        console.log('DEBUG: Email entered:', forgotPasswordEmail);
        console.log('DEBUG: API base URL:', api.defaults.baseURL);
        
        setMessage('Sending password recovery email...');
        
        api.post('/forgot-password', { email: forgotPasswordEmail })
            .then(response => {
                console.log('DEBUG: Forgot password API response:', response);
                console.log('DEBUG: Response data:', response.data);
                setMessage('Password recovery email sent successfully!');
            })
            .catch(error => {
                console.error('DEBUG: Forgot password API error:', error);
                console.error('DEBUG: Error response:', error.response);
                console.error('DEBUG: Error data:', error.response?.data);
                console.error('DEBUG: Error status:', error.response?.status);
                setMessage(`Error: ${error.response?.data?.message || error.message || 'Failed to send recovery email'}`);
            });
    };

    return (
        <InfoPage title="Login" className="login-page account-page">
            <div className="login-card account-panel">
                <p className="login-welcome">Welcome {username} {email}</p>

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="login-field">
                        <label htmlFor="login-email">Email</label>
                        <input
                            className="account-control"
                            id="login-email"
                            type="email"
                            value={submitemail}
                            onChange={(e) => setsubmitEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="login-password">Password</label>
                        <input
                            className="account-control"
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button className="login-primary-btn account-button" type="submit">Login</button>
                </form>

                <div className="login-inline-action">
                    <button className="login-link-btn account-link" onClick={() => setShowForgotPasswordForm(!showForgotPasswordForm)}>
                        {isLoggedIn ? 'Change Password?' : 'Forgot Password?'}
                    </button>
                </div>

                {showForgotPasswordForm && (
                    <form className="login-forgot-form" onSubmit={handleForgotPasswordSubmit}>
                        <div className="login-field">
                            <label htmlFor="login-recovery-email">Enter your email to reset password</label>
                            <input
                                className="account-control"
                                id="login-recovery-email"
                                type="email"
                                value={forgotPasswordEmail}
                                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button className="login-primary-btn account-button" type="submit">Submit</button>
                    </form>
                )}

                <p className="login-register-row">
                    Don't have an account?{' '}
                    <Link className="login-register-link account-link" to="/signup">
                        Register
                    </Link>
                </p>

                {message && (
                    <p className="login-message">
                        {message}
                        {redirectCountdown !== null && (
                            <span> Redirecting in {redirectCountdown}...</span>
                        )}
                    </p>
                )}
            </div>
        </InfoPage>
    );
}

export default Login;
