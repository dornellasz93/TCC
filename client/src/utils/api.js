/**
 * Cliente HTTP centralizado com gerenciamento de Token JWT
 * Projeto TCC - UGB Presença
 */

const TOKEN_KEY = 'ugb_presenca_token';
const USER_KEY = 'ugb_presenca_user';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthSession(user, token) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage quota errors
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({ success: false, message: 'Resposta inválida do servidor.' }));
  return { ok: res.ok, status: res.status, data };
}

export async function demoLoginUser(userId) {
  const { ok, data } = await apiFetch('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  if (ok && data.success && data.user && data.token) {
    setAuthSession(data.user, data.token);
    return { user: data.user, token: data.token };
  }
  return null;
}
