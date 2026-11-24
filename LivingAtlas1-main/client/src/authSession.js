const storageKey = 'livingAtlasSession';

export function storeSession(email, token) {
    sessionStorage.setItem(storageKey, JSON.stringify({ email, token }));
}

export function getSessionToken(requireEmailMatch = true) {
    try {
        const session = JSON.parse(sessionStorage.getItem(storageKey));
        if (!session || (requireEmailMatch && session.email !== localStorage.getItem('email'))) return null;
        return session.token;
    } catch {
        return null;
    }
}

export function clearSession() {
    sessionStorage.removeItem(storageKey);
}
