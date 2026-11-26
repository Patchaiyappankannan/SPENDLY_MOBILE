import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';

let tokenCache = null;
export async function getToken() {
  if (tokenCache === null) tokenCache = (await SecureStore.getItemAsync('token')) || '';
  return tokenCache;
}
export async function setToken(t) {
  tokenCache = t || '';
  if (t) await SecureStore.setItemAsync('token', t);
  else await SecureStore.deleteItemAsync('token');
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function request(path, { method = 'GET', body, auth = true, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const tok = await getToken();
      if (tok) headers.Authorization = 'Bearer ' + tok;
    }
    const res = await fetch(API_URL + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.message || 'Request failed', res.status);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const network = await NetInfo.fetch().catch(() => null);
    if (network?.isConnected === false || network?.isInternetReachable === false) {
      throw new ApiError('No internet connection. Turn on Wi-Fi or mobile data and try again.', 0);
    }
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}
