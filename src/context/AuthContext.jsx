import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const API_URL = (import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`).replace(/\/$/, '');
const TOKEN_KEY = 'kamil_auth_token';
const EMAIL_KEY = 'kamil_auth_email';

async function apiFetch(path, method, body) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw { code: data.error || 'error', message: data.error || 'Request failed' };
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: check if saved token is still valid
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const email = localStorage.getItem(EMAIL_KEY);
    if (!token || !email) { setLoading(false); return; }

    // Safety: never stay on loading screen more than 6 seconds
    const safetyTimer = setTimeout(() => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
      setLoading(false);
    }, 6000);

    // Verify token with backend (with 5s timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const token_ = localStorage.getItem(TOKEN_KEY);
    fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token_}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        const data = await res.json();
        if (res.ok) setUser({ email: data.email, displayName: data.email.split('@')[0], authMethods: data.authMethods || [] });
        else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(EMAIL_KEY); }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Network error or timeout — clear session so login page shows
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EMAIL_KEY);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    return () => { clearTimeout(safetyTimer); clearTimeout(timeoutId); controller.abort(); };
  }, []);

  const persistSession = useCallback((token, serverEmail, authMethods = []) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, serverEmail);
    setUser({ email: serverEmail, displayName: serverEmail.split('@')[0], authMethods });
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await apiFetch('/api/auth/login', 'POST', { email, password });
    if (response.token) persistSession(response.token, response.email, response.authMethods);
    return response;
  }, [persistSession]);

  const verifyMfa = useCallback(async (challengeToken, code) => {
    const response = await apiFetch('/api/auth/mfa/verify', 'POST', { challengeToken, code });
    persistSession(response.token, response.email, response.authMethods);
    return response;
  }, [persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword, mfaCode) => {
    const response = await apiFetch('/api/auth/change-password', 'POST', { currentPassword, newPassword, mfaCode });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setUser(null);
    return response;
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const { token, email: serverEmail, authMethods } = await apiFetch('/api/auth/google', 'POST', { credential });
    persistSession(token, serverEmail, authMethods);
  }, [persistSession]);

  // Provide getIdToken so ShopContext can get the Bearer token
  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfa, googleLogin, logout, changePassword, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
