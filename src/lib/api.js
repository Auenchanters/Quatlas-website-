import { useCallback, useEffect, useState } from 'react';

// VITE_API lets the admin screens run against scripts/mock-api.mjs instead of live data.
export const API = import.meta.env.VITE_API ?? 'https://quatlasserver.vercel.app/api';
export const RECRUIT_SHEET = import.meta.env.VITE_SHEET ??
  'https://script.google.com/macros/s/AKfycbwD9n6VnW6W3YoFzBUR-1IoCeBrbuZ5fcAEeltr2D4fcHbBthRvWhNAOJQWm7j7EbGm3A/exec';

// Same sessionStorage keys as the original site, so existing sessions keep working.
export const session = {
  get token() { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('token'); },
  get(key) { return sessionStorage.getItem(key); },
  set(values) { for (const [k, v] of Object.entries(values)) sessionStorage.setItem(k, v); },
  clear() { for (const k of ['token', 'name', 'email', 'id']) sessionStorage.removeItem(k); },
};

export async function api(path, { method = 'GET', body, auth = false, url } = {}) {
  const headers = { 'Content-type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(url ?? API + path, { method, headers, body: body && JSON.stringify(body) });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.msg || `The server answered ${res.status}. Try again.`);
  return data;
}

// GET on mount, with reload() for after a write.
export function useApi(path, { auth = false, url, map = (d) => d } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: map(await api(path, { auth, url })), error: null, loading: false });
    } catch (e) {
      setState({ data: null, error: e.message, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, auth, url]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
