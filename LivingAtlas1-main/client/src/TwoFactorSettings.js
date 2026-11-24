import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import EmailVerificationForm from './EmailVerificationForm';

const settingsEndpoint = '/account/two-factor';

export default function TwoFactorSettings() {
    const [status, setStatus] = useState('loading');
    const [isEditing, setIsEditing] = useState(false);
    const [password, setPassword] = useState('');
    const [challenge, setChallenge] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState('');
    const saveRequest = useRef(null);
    const enabled = status === 'on';

    useEffect(() => {
        if (status !== 'loading') return undefined;
        const controller = new AbortController();
        api.get(settingsEndpoint, { signal: controller.signal })
            .then(({ data }) => {
                if (controller.signal.aborted) return;
                if (typeof data.enabled !== 'boolean') {
                    setStatus('unavailable');
                    return;
                }
                setStatus(data.enabled ? 'on' : 'off');
            })
            .catch((error) => {
                if (!controller.signal.aborted) {
                    setStatus(error.response?.status === 401 ? 'session-expired' : 'unavailable');
                }
            });
        return () => controller.abort();
    }, [status]);

    useEffect(() => () => saveRequest.current?.abort(), []);

    const closeForm = () => {
        setIsEditing(false);
        setChallenge(null);
        setPassword('');
        setFeedback('');
    };

    const finishSaving = (value) => {
        closeForm();
        setStatus(value ? 'on' : 'off');
        setFeedback(value ? 'Two-factor authentication turned on.' : 'Two-factor authentication turned off.');
    };

    const saveSetting = async (event) => {
        event.preventDefault();
        if (saveRequest.current) return;

        const controller = new AbortController();
        saveRequest.current = controller;
        setFeedback('');
        setIsSaving(true);
        try {
            const { data } = await api.put(settingsEndpoint, { enabled: !enabled, password }, {
                skipRetry: true,
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (typeof data.enabled === 'boolean') {
                finishSaving(data.enabled);
            } else if (!enabled && data.challenge_id) {
                setPassword('');
                setChallenge({ challengeId: data.challenge_id, resendAfter: data.resend_after });
            } else {
                setFeedback('Could not update two-factor authentication. Please try again.');
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            const detail = error.response?.data?.detail;
            setFeedback(typeof detail === 'string' ? detail : 'Could not update two-factor authentication. Please try again.');
        } finally {
            saveRequest.current = null;
            if (!controller.signal.aborted) setIsSaving(false);
        }
    };

    const confirmEnable = (data) => {
        if (data.enabled === true) {
            finishSaving(true);
        } else {
            closeForm();
            setFeedback('Could not turn on two-factor authentication. Please try again.');
        }
    };

    return (
        <section className="account-panel profile-two-factor" aria-labelledby="profile-two-factor-title">
            <h2 id="profile-two-factor-title" className="info-page__subheading">Two-factor authentication</h2>
            <p>Use a code sent to your account email each time you sign in.</p>

            {status === 'loading' && <p role="status">Loading setting…</p>}
            {status === 'session-expired' && (
                <p role="status"><Link to="/login" className="account-link">Sign in again</Link> to manage this setting.</p>
            )}
            {status === 'unavailable' && (
                <>
                    <p role="status">Could not load this setting.</p>
                    <button className="account-button account-button--secondary" type="button" onClick={() => setStatus('loading')}>
                        Try again
                    </button>
                </>
            )}

            {(status === 'on' || status === 'off') && (
                <>
                    <p><strong>{enabled ? 'On' : 'Off'}</strong></p>
                    {!isEditing && (
                        <button className="account-button account-button--secondary" type="button" onClick={() => {
                            setFeedback('');
                            setIsEditing(true);
                        }}>
                            {enabled ? 'Turn off' : 'Turn on'}
                        </button>
                    )}
                    {isEditing && !challenge && (
                        <form className="profile-two-factor-form" onSubmit={saveSetting}>
                            <div className="profile-form-field">
                                <label htmlFor="two-factor-password">Current password</label>
                                <input
                                    id="two-factor-password"
                                    className="account-control"
                                    type="password"
                                    autoComplete="current-password"
                                    autoFocus
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    disabled={isSaving}
                                    required
                                />
                            </div>
                            <div className="email-verification-actions">
                                <button className="account-button" type="submit" disabled={isSaving}>
                                    {isSaving ? 'Saving…' : (enabled ? 'Turn off' : 'Send verification code')}
                                </button>
                                <button className="account-button account-button--secondary" type="button" onClick={closeForm} disabled={isSaving}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                    {challenge && (
                        <EmailVerificationForm
                            {...challenge}
                            challengeEndpoint={settingsEndpoint}
                            onVerified={confirmEnable}
                            onCancel={closeForm}
                            cancelLabel="Cancel"
                        />
                    )}
                </>
            )}

            <div role="status">
                {feedback && <p className="profile-two-factor-feedback">{feedback}</p>}
            </div>
        </section>
    );
}
