import api, { signOutSession } from './api';
import { getSessionToken, storeSession } from './authSession';

const email = 'fixture@example.invalid';
const token = 'test-session-token';

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('email', email);
    storeSession(email, token);
    api.defaults.adapter = jest.fn(config => Promise.resolve({ config, status: 200, data: {} }));
});

test('sends the active session only to protected first-party routes', async () => {
    const deletion = await api.delete('/deleteCard', { params: { card_id: 17 } });
    expect(deletion.config.headers.get('Authorization')).toBe(`Bearer ${token}`);
    expect(deletion.config.params).toEqual({ card_id: 17 });
    const publicRequest = await api.get('/allCards');
    expect(publicRequest.config.headers.get('Authorization')).toBeUndefined();
    const otherOrigin = await api.delete('/deleteCard', { baseURL: 'https://fixture.example.invalid' });
    expect(otherOrigin.config.headers.get('Authorization')).toBeUndefined();
});

test('a mismatched tab account never sends a stale session for deletion', async () => {
    localStorage.setItem('email', 'other@example.invalid');
    const deletion = await api.delete('/deleteCard');
    expect(deletion.config.headers.get('Authorization')).toBeUndefined();
    const login = await api.post('/profileAccount', {});
    expect(login.config.headers.get('Authorization')).toBe(`Bearer ${token}`);
});

test('logout immediately clears the local session and revokes its captured token', async () => {
    const revocation = signOutSession();
    expect(getSessionToken(false)).toBeNull();
    const response = await revocation;
    expect(response.config.url).toBe('/session');
    expect(response.config.headers.get('Authorization')).toBe(`Bearer ${token}`);
});
