import React, { useEffect, useRef, useState } from 'react';
import api from './api';
import './EmailVerificationForm.css';

export default function EmailVerificationForm({ challengeId, endpoint, headers, onVerified, onCancel, cancelLabel }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const request = useRef(null);

    useEffect(() => () => request.current?.abort(), []);

    const verify = async (event) => {
        event.preventDefault();
        if (request.current || isFinished) return;

        const controller = new AbortController();
        request.current = controller;
        setIsVerifying(true);
        setError('');
        try {
            const { data } = await api.post(endpoint, { challenge_id: challengeId, code }, {
                headers,
                skipRetry: true,
                signal: controller.signal,
            });
            if (!controller.signal.aborted) onVerified(data);
        } catch (err) {
            if (controller.signal.aborted) return;
            const { status, data } = err.response || {};
            if (status === 410 || status === 429) setIsFinished(true);
            setError(typeof data?.detail === 'string'
                ? data.detail
                : 'Could not verify your code. Please try again.');
        } finally {
            request.current = null;
            if (!controller.signal.aborted) setIsVerifying(false);
        }
    };

    return (
        <form className="email-verification-form" onSubmit={verify} aria-label="Email verification">
            <div>
                <label htmlFor="email-verification-code">Verification code</label>
                <p id="email-verification-instructions">Enter the six-digit code sent to your email.</p>
                <input
                    className="account-control"
                    id="email-verification-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    pattern="[0-9]{6}"
                    aria-describedby="email-verification-instructions"
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={isVerifying || isFinished}
                />
            </div>
            {error && <p className="email-verification-error" role="alert">{error}</p>}
            <div className="email-verification-actions">
                <button className="account-button" type="submit" disabled={isVerifying || isFinished}>
                    {isVerifying ? 'Verifying…' : 'Verify code'}
                </button>
                <button className="account-button account-button--secondary" type="button" onClick={onCancel} disabled={isVerifying}>
                    {cancelLabel}
                </button>
            </div>
        </form>
    );
}
