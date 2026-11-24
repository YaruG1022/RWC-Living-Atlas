import React, { useEffect, useRef, useState } from 'react';
import api from './api';
import './EmailVerificationForm.css';

const DEFAULT_RESEND_AFTER = 60;

function resendAvailableAt(now, seconds) {
    const delay = Number(seconds);
    return now + 1000 * (Number.isFinite(delay) && delay > 0 ? delay : DEFAULT_RESEND_AFTER);
}

export default function EmailVerificationForm({ challengeId, challengeEndpoint, resendAfter, headers, onVerified, onCancel, cancelLabel }) {
    const hasResend = Number.isInteger(resendAfter) && resendAfter > 0;
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [pendingAction, setPendingAction] = useState(null);
    const [isFinished, setIsFinished] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [resendAt, setResendAt] = useState(() => hasResend ? resendAvailableAt(now, resendAfter) : now);
    const request = useRef(null);
    const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
    const isWaiting = waitSeconds > 0;
    const isBusy = pendingAction !== null;

    useEffect(() => () => request.current?.abort(), []);

    useEffect(() => {
        if (!isWaiting || isFinished) return undefined;
        const clock = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(clock);
    }, [isWaiting, isFinished]);

    const startCooldown = seconds => {
        const startedAt = Date.now();
        setNow(startedAt);
        setResendAt(resendAvailableAt(startedAt, seconds));
    };

    const submit = async action => {
        const isResend = action === 'resend';
        if (request.current || isFinished || (isResend && (!hasResend || Date.now() < resendAt))) return;

        const controller = new AbortController();
        request.current = controller;
        setPendingAction(action);
        setError('');
        setNotice('');

        try {
            const payload = isResend ? { challenge_id: challengeId } : { challenge_id: challengeId, code };
            const { data } = await api.post(`${challengeEndpoint}/${action}`, payload, {
                headers,
                skipRetry: true,
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (isResend) {
                setCode('');
                startCooldown(data.resend_after);
                setNotice('A new code was sent. Use the code from the latest email.');
            } else {
                onVerified(data);
            }
        } catch (err) {
            if (controller.signal.aborted) return;
            const { status, data, headers: responseHeaders } = err.response || {};
            if (status === 410 || (!isResend && status === 429)) setIsFinished(true);
            if (isResend && (status === 429 || status === 503 || !status)) {
                startCooldown(responseHeaders?.['retry-after']);
            }
            setError(typeof data?.detail === 'string'
                ? data.detail
                : (isResend ? 'Could not send a new code. Please try again.' : 'Could not verify your code. Please try again.'));
        } finally {
            request.current = null;
            if (!controller.signal.aborted) setPendingAction(null);
        }
    };

    const verify = event => {
        event.preventDefault();
        submit('verify');
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
                    disabled={isBusy || isFinished}
                />
            </div>
            {error && <p className="email-verification-error" role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <div className="email-verification-actions">
                <button className="account-button" type="submit" disabled={isBusy || isFinished}>
                    {pendingAction === 'verify' ? 'Verifying…' : 'Verify code'}
                </button>
                {hasResend && (
                    <button
                        className="account-button account-button--secondary"
                        type="button"
                        onClick={() => submit('resend')}
                        disabled={isBusy || isFinished || isWaiting}
                        aria-describedby={isWaiting && !isFinished ? 'email-verification-resend-wait' : undefined}
                    >
                        {pendingAction === 'resend' ? 'Sending…' : 'Resend code'}
                    </button>
                )}
                <button className="account-button account-button--secondary" type="button" onClick={onCancel} disabled={isBusy}>
                    {cancelLabel}
                </button>
            </div>
            {isWaiting && !isFinished && (
                <p id="email-verification-resend-wait">
                    You can resend a code in {waitSeconds} {waitSeconds === 1 ? 'second' : 'seconds'}.
                </p>
            )}
        </form>
    );
}
