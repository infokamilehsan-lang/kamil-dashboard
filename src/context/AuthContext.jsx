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

    // Verify token with backend
    apiFetch('/api/auth/me', 'GET')
      .then(({ email: serverEmail }) => {
        setUser({ email: serverEmail, displayName: serverEmail.split('@')[0] });
      })
      .catch(() => {
        // Token expired or server down — clear session
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EMAIL_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, email: serverEmail } = await apiFetch('/api/auth/login', 'POST', { email, password });
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, serverEmail);
    setUser({ email: serverEmail, displayName: serverEmail.split('@')[0] });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await apiFetch('/api/auth/change-password', 'POST', { currentPassword, newPassword });
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const { token, email: serverEmail } = await apiFetch('/api/auth/google', 'POST', { credential });
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, serverEmail);
    setUser({ email: serverEmail, displayName: serverEmail.split('@')[0] });
  }, []);

  // Provide getIdToken so ShopContext can get the Bearer token
  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, logout, changePassword, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


