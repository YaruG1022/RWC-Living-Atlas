import { useEffect } from 'react';
import api from './api';
import { getSessionToken } from './authSession';

const HEARTBEAT_INTERVAL_MS = 45_000;

export default function useSessionHeartbeat(activeEmail) {
    useEffect(() => {
        if (!activeEmail) return undefined;

        let pending = null;
        let rejectedToken = null;

        const sendHeartbeat = async () => {
            if (pending || document.visibilityState === 'hidden' || navigator.onLine === false) return;
            const token = getSessionToken();
            if (!token || token === rejectedToken) return;

            const request = new AbortController();
            pending = request;
            try {
                await api.post('/session/heartbeat', null, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: request.signal,
                    skipRetry: true,
                    timeout: 20_000,
                });
            } catch (error) {
                if (error.response?.status === 401) rejectedToken = token;
            } finally {
                pending = null;
            }
        };

        sendHeartbeat();
        const interval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        document.addEventListener('visibilitychange', sendHeartbeat);
        window.addEventListener('online', sendHeartbeat);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', sendHeartbeat);
            window.removeEventListener('online', sendHeartbeat);
            pending?.abort();
        };
    }, [activeEmail]);
}
