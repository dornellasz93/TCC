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
 * Verifica se o host atual é um IP privado/rede local (onde usamos a porta HTTPS local 5443)
 * ou um domínio público como Cloudflare Tunnel (onde o HTTPS roda na porta padrão 443).
 */
export function isPrivateNetworkHost(hostname) {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
    return true;
  }
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

/**
 * Detecta se a página foi aberta em HTTP inseguro fora de localhost (ex.: http://192.168.x.x:5000
 * ou http://tcc.seudominio.com.br), onde navegadores bloqueiam Geolocation e getUserMedia.
 */
export function isInsecureRemoteOrigin() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return !window.isSecureContext && window.location.protocol === 'http:' && !isLocal;
}

/**
 * Redireciona para HTTPS preservando o token JWT:
 * - Em domínio público (ex.: Cloudflare Tunnel), usa https://<dominio> (porta 443 padrão).
 * - Em IP da rede local (ex.: 192.168.x.x), prepara o SAN do certificado e usa https://<ip>:5443.
 */
export async function redirectToHttpsPortal(fallbackPort = 5443) {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const token = getAuthToken();
  const hashSuffix = token ? `#sso_token=${encodeURIComponent(token)}` : '';
  const pathAndQuery = `${window.location.pathname}${window.location.search}`;

  if (!isPrivateNetworkHost(host)) {
    window.location.href = `https://${host}${pathAndQuery}${hashSuffix}`;
    return;
  }

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
