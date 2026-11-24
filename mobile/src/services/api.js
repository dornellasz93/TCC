import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const STORAGE_KEYS = {
  SERVER_URL: '@ugb_presenca_server_url',
  TOKEN: '@ugb_presenca_token',
  USER: '@ugb_presenca_user'
};

let cachedServerUrl = null;
let cachedToken = null;

/**
 * Automatically detects the dev host IP when running on Expo Go over Wi-Fi,
 * falling back to standard localhost/Android emulator host.
 */
export function getDefaultServerUrl() {
  try {
    const candidates = [
      NativeModules?.SourceCode?.scriptURL,
      globalThis?.expo?.modules?.ExponentConstants?.experienceUrl,
      globalThis?.expo?.modules?.ExponentConstants?.linkingUri,
      NativeModules?.ExponentConstants?.linkingUri
    ];
    for (const raw of candidates) {
      if (typeof raw !== 'string') continue;
      const match = raw.match(/^(?:https?|exp):\/\/([^:/]+)/i);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1' && !match[1].includes('exp.direct')) {
        return `http://${match[1]}:5000`;
      }
    }
  } catch {
    // ignore
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
}

export async function getServerUrl() {
  if (cachedServerUrl) return cachedServerUrl;
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
  cachedServerUrl = saved ? saved.replace(/\/+$/, '') : getDefaultServerUrl();
  return cachedServerUrl;
}

export async function setServerUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  cachedServerUrl = clean || getDefaultServerUrl();
  await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, cachedServerUrl);
  return cachedServerUrl;
}

export async function getAuthToken() {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  return cachedToken;
}

export async function saveAuthSession(user, token) {
  if (token) {
    cachedToken = token;
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
  }
  if (user) {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
}

export async function loadStoredSession() {
  const [userRaw, token, serverUrl] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.USER),
    AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
    getServerUrl()
  ]);
  cachedToken = token || null;
  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }
  return { user, token, serverUrl };
}

export async function clearAuthSession() {
  cachedToken = null;
  await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
}

export async function apiRequest(endpoint, options = {}, overrideBaseUrl = null) {
  const baseUrl = overrideBaseUrl ? overrideBaseUrl.replace(/\/+$/, '') : await getServerUrl();
  const token = await getAuthToken();

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const start = Date.now();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    const latencyMs = Date.now() - start;
    const data = await res.json().catch(() => ({
      success: false,
      message: 'Resposta inválida do servidor.'
    }));
    return { ok: res.ok, status: res.status, data, latencyMs };
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? `Tempo esgotado ao conectar em ${baseUrl}. Verifique IP/Wi-Fi ou Docker.`
      : `Falha de conexão com ${baseUrl}. Verifique se o servidor Docker está rodando.`;
    return { ok: false, status: 0, data: { success: false, message: msg }, latencyMs: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function testServerHealth(urlToTest) {
  return apiRequest('/api/health', { method: 'GET', timeoutMs: 6000 }, urlToTest);
}
