import React, { useState, useEffect, useRef } from 'react';
import { Link, useHistory } from 'react-router-dom';
import InfoPage from './InfoPage';
import EmailVerificationForm from './EmailVerificationForm';
import './AccountPage.css';
import './Login.css';
import api from './api.js';
import { getSessionToken, storeSession } from './authSession';

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [challenge, setChallenge] = useState(null);
    const loginRequest = useRef(null);
    const history = useHistory();

    useEffect(() => () => loginRequest.current?.abort(), []);

    const finishLogin = (data) => {
        const accountData = data['Account Information'];
        if (!accountData?.length || !data.session_token) {
            setMessage('Could not sign in. Please try again.');
            return;
        }

        const [name, accountEmail, rawIsAdmin] = accountData[0];
        const resolvedIsAdmin = normalizeAdminFlag(rawIsAdmin);
        storeSession(accountEmail, data.session_token);
        localStorage.setItem('isLoggedIn', JSON.stringify(true));
        localStorage.setItem('email', accountEmail);
        localStorage.setItem('username', name);
        localStorage.setItem('isAdmin', JSON.stringify(resolvedIsAdmin));

        // Save account for Switch Account only after sign-in succeeds.
        const savedAccounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
        const existingIdx = savedAccounts.findIndex(account => account.email === accountEmail);
        const accountEntry = { email: accountEmail, username: name, password };
        if (existingIdx >= 0) {
            savedAccounts[existingIdx] = accountEntry;
        } else {
            savedAccounts.push(accountEntry);
        }
        localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));

        setChallenge(null);
        setPassword('');
        setIsLoggedIn(true);
        setUsername(name);
        setEmail(accountEmail);
        setIsAdmin(resolvedIsAdmin);
        history.push('/');
    };

    const cancelVerification = () => {
        setChallenge(null);
        setPassword('');
        setMessage('');
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        if (loginRequest.current) return;

        const controller = new AbortController();
        const previousToken = getSessionToken(false);
        const headers = previousToken ? { Authorization: `Bearer ${previousToken}` } : undefined;
        loginRequest.current = controller;
        setIsSubmitting(true);
        setMessage('');
        try {
            const { data } = await api.post('/profileAccount', { email: submitemail, password }, {
                headers,
                skipRetry: true,
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (data.two_factor_required && data.challenge_id) {
                setChallenge({ challengeId: data.challenge_id, resendAfter: data.resend_after, headers });
                setShowForgotPasswordForm(false);
            } else {
                finishLogin(data);
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            const { status, data } = error.response || {};
            if (status === 401) {
                setMessage('Invalid email or password.');
            } else {
                setMessage(typeof data?.detail === 'string' ? data.detail : 'Error during login. Please try again.');
            }
        } finally {
            loginRequest.current = null;
            if (!controller.signal.aborted) setIsSubmitting(false);
        }
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

                {challenge ? (
                    <EmailVerificationForm
                        {...challenge}
                        challengeEndpoint="/profileAccount"
                        onVerified={finishLogin}
                        onCancel={cancelVerification}
                        cancelLabel="Back to login"
                    />
                ) : (
                    <>
                        <form className="login-form" onSubmit={handleLogin}>
                            <div className="login-field">
                                <label htmlFor="login-email">Email</label>
                                <input
                                    className="account-control"
                                    id="login-email"
                                    type="email"
                                    autoComplete="username"
                                    value={submitemail}
                                    onChange={(e) => setsubmitEmail(e.target.value)}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            <div className="login-field">
                                <label htmlFor="login-password">Password</label>
                                <input
                                    className="account-control"
                                    id="login-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            <button className="login-primary-btn account-button" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Signing in…' : 'Login'}
                            </button>
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
                    </>
                )}

                <div role="status">
                    {message && <p className="login-message">{message}</p>}
                </div>
            </div>
        </InfoPage>
    );
}

export default Login;
