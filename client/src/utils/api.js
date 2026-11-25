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
    // ignora erros de cota de armazenamento
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
    // ignora
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

/**
 * Detecta se a página foi aberta em HTTP inseguro fora de localhost (ex.: http://192.168.x.x:5000),
 * onde navegadores mobile bloqueiam HTML5 Geolocation e getUserMedia (Câmera).
 */
export function isInsecureRemoteOrigin() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return !window.isSecureContext && window.location.protocol === 'http:' && !isLocal;
}

/**
 * Garante que o certificado TLS do servidor contenha o IP/host atual no SAN e redireciona
 * para a porta HTTPS local preservando o token JWT da sessão atual via hash fragment.
 */
export async function redirectToHttpsPortal(fallbackPort = 5443) {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  let httpsPort = fallbackPort;

  try {
    const res = await fetch(`/api/ssl/prepare?host=${encodeURIComponent(host)}`);
    const data = await res.json();
    if (data?.httpsPort) {
      httpsPort = Number(data.httpsPort);
    }
  } catch {
    // Continua com a porta padrão 5443
  }

  const token = getAuthToken();
  const hashSuffix = token ? `#sso_token=${encodeURIComponent(token)}` : '';
  const pathAndQuery = `${window.location.pathname}${window.location.search}`;
  window.location.href = `https://${host}:${httpsPort}${pathAndQuery}${hashSuffix}`;
}

/**
 * Restaura automaticamente a sessão autenticada ao chegar no domínio HTTPS vindo do HTTP.
 */
export async function consumeSsoTokenFromHash() {
  if (typeof window === 'undefined' || !window.location.hash.includes('sso_token=')) {
    return null;
  }

  const rawHash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(rawHash);
  const ssoToken = params.get('sso_token');

  // Remove o token da barra de endereços imediatamente
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

  if (!ssoToken) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${ssoToken}` }
    });
    const data = await res.json();
    if (res.ok && data?.success && data?.user) {
      setAuthSession(data.user, ssoToken);
      return data.user;
    }
  } catch {
    // Ignora falha silenciosamente
  }
  return null;
}
