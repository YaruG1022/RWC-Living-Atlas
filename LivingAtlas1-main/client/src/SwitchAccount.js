import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faCheckCircle, faPlus, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import api, { signOutSession } from './api';
import { getSessionToken, storeSession } from './authSession';
import EmailVerificationForm from './EmailVerificationForm';
import InfoPage from './InfoPage';
import './AccountPage.css';
import './SwitchAccount.css';

function SwitchAccount({ email, setEmail, setPassword, setMessage, setIsLoggedIn, setUsername, setIsAdmin }) {
  const history = useHistory();
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [currentEmail, setCurrentEmail] = useState(email);
  const [switching, setSwitching] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState('');
  const switchRequest = useRef(null);

  useEffect(() => {
    // Load saved accounts from localStorage
    const accounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
    setCurrentEmail(localStorage.getItem('email') || '');
    setSavedAccounts(accounts);
    return () => switchRequest.current?.abort();
  }, []);

  const removeSavedAccount = (accountEmail) => {
    const updated = savedAccounts.filter(account => account.email !== accountEmail);
    localStorage.setItem('savedAccounts', JSON.stringify(updated));
    setSavedAccounts(updated);
  };

  const finishSwitch = (data) => {
    const accountData = data['Account Information'];
    if (!accountData?.length || !data.session_token) return false;

    const [name, accountEmail, rawIsAdmin] = accountData[0];
    const isAdmin = [true, 't', 'true'].includes(rawIsAdmin);
    storeSession(accountEmail, data.session_token);
    localStorage.setItem('isLoggedIn', JSON.stringify(true));
    localStorage.setItem('email', accountEmail);
    localStorage.setItem('username', name);
    localStorage.setItem('isAdmin', JSON.stringify(isAdmin));

    setIsLoggedIn(true);
    setUsername(name);
    setEmail(accountEmail);
    setIsAdmin(isAdmin);
    setMessage('Switched account successfully!');
    history.push('/');
    return true;
  };

  const verifySwitch = (data) => {
    if (!finishSwitch(data)) {
      setChallenge(null);
      setError('Failed to switch account. Please try again.');
    }
  };

  const handleSwitchTo = async (account) => {
    if (account.email === currentEmail || switchRequest.current) return;

    const controller = new AbortController();
    const previousToken = getSessionToken(false);
    const headers = previousToken ? { Authorization: `Bearer ${previousToken}` } : undefined;
    switchRequest.current = controller;
    setError('');
    setSwitching(true);

    try {
      const { data } = await api.post('/profileAccount', { email: account.email, password: account.password }, {
        headers,
        skipRetry: true,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (data.two_factor_required && data.challenge_id) {
        setChallenge({ challengeId: data.challenge_id, resendAfter: data.resend_after, headers });
      } else if (!finishSwitch(data)) {
        removeSavedAccount(account.email);
        setError('Session expired. Please log in again.');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const { status, data } = err.response || {};
      if (status === 401) {
        removeSavedAccount(account.email);
        setError('Credentials changed. Please log in again.');
      } else {
        setError(typeof data?.detail === 'string' ? data.detail : 'Failed to switch account. Please try again.');
      }
    } finally {
      switchRequest.current = null;
      if (!controller.signal.aborted) setSwitching(false);
    }
  };

  const handleAddAccount = () => {
    history.push('/login');
  };

  const handleSignOut = () => {
    signOutSession();
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
    setUsername("You're logged out.");
    setIsAdmin(false);
    setMessage('Successfully logged out.');

    localStorage.setItem('isLoggedIn', JSON.stringify(false));
    localStorage.setItem('email', '');
    localStorage.setItem('username', '');
    localStorage.setItem('isAdmin', JSON.stringify(false));

    history.push('/login');
  };

  const currentAccount = savedAccounts.find(a => a.email === currentEmail);
  const otherAccounts = savedAccounts.filter(a => a.email !== currentEmail);

  return (
    <InfoPage title="Switch Accounts" className="switch-account-container account-page">
      <div className="switch-account-card account-panel">
        <div className="switch-account-header">
          <button type="button" className="sign-out-link account-button account-button--secondary account-button--small" onClick={handleSignOut}>
            <FontAwesomeIcon icon={faSignOutAlt} /> Sign out
          </button>
        </div>

        {challenge ? (
          <EmailVerificationForm
            {...challenge}
            challengeEndpoint="/profileAccount"
            onVerified={verifySwitch}
            onCancel={() => setChallenge(null)}
            cancelLabel="Back to accounts"
          />
        ) : (
          <>
            {currentAccount && (
              <div className="account-item current-account">
                <div className="account-check">
                  <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                </div>
                <div className="account-avatar">
                  <FontAwesomeIcon icon={faUserCircle} className="avatar-icon" />
                </div>
                <div className="account-info">
                  <span className="account-name">{currentAccount.username}</span>
                  <span className="account-label">Current Account</span>
                  <span className="account-email">{currentAccount.email}</span>
                </div>
              </div>
            )}

            {otherAccounts.map((account) => (
              <button
                type="button"
                key={account.email}
                className={`account-item other-account account-button account-button--secondary ${switching ? 'disabled' : ''}`}
                onClick={() => handleSwitchTo(account)}
                disabled={switching}
              >
                <span className="account-check" />
                <span className="account-avatar">
                  <FontAwesomeIcon icon={faUserCircle} className="avatar-icon" />
                </span>
                <span className="account-info">
                  <span className="account-name">{account.username}</span>
                  <span className="account-email">{account.email}</span>
                </span>
              </button>
            ))}

            <button type="button" className="account-item add-account account-button account-button--secondary" onClick={handleAddAccount} disabled={switching}>
              <span className="account-check" />
              <span className="account-avatar">
                <span className="add-icon-circle">
                  <FontAwesomeIcon icon={faPlus} className="add-icon" />
                </span>
              </span>
              <span className="account-info">
                <span className="add-account-text">Add account</span>
              </span>
            </button>
          </>
        )}

        <div role="status">
          {switching && <p>Checking account…</p>}
          {error && <p>{error}</p>}
        </div>
      </div>
    </InfoPage>
  );
}

export default SwitchAccount;
