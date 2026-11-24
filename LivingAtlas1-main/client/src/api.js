import axios from "axios";
import { clearSession, getSessionToken } from './authSession';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://cereo-backend.onrender.com',
  timeout: 90000, // 90 second timeout — accounts for Render free-tier cold start (~30-90s)
  //https://verdant-smakager-ef450d.netlify.app    //Netlify Frontend Link
});

const sessionPaths = new Set([
  '/reset-password',
  '/account/two-factor',
  '/account/two-factor/verify',
  '/deleteCard',
  '/uploadForm',
  '/list_database',
  '/fetch_signup_requests',
  '/edit_user_role',
  '/uploadAccount',
]);

// Send credentials only to the configured Atlas backend and first-party routes.
api.interceptors.request.use((config) => {
  const path = (config.url || '').split('?')[0];
  const isLogin = path === '/profileAccount' && config.method === 'post';
  if (
    config.baseURL === api.defaults.baseURL &&
    (isLogin || sessionPaths.has(path) || path.startsWith('/deny_request/') || path.startsWith('/delete_user/')) &&
    !config.headers.has('Authorization')
  ) {
    const token = getSessionToken(!isLogin);
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Retry eligible requests once without logging credentials, bodies, or headers.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config;
    // Retry once on timeout or network error (handles Render cold start)
    if (
      config &&
      !config._retried &&
      !config.skipRetry &&
      (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response)
    ) {
      config._retried = true;
      return new Promise((resolve) => setTimeout(resolve, 2000)).then(() => api(config));
    }

    return Promise.reject(error);
  }
);

export function signOutSession() {
  const token = getSessionToken(false);
  clearSession();
  return token ? api.delete('/session', {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {}) : Promise.resolve();
}

export default api; 
