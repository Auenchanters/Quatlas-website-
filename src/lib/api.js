import { useCallback, useEffect, useRef, useState } from 'react';

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

// GET on mount, with reload() for after a write. `initial` (raw, as the API returns it) renders at once
// and in the prerendered HTML; the fetch then replaces it.
export function useApi(path, { auth = false, url, map = (d) => d, initial } = {}) {
  const [state, setState] = useState(() => initial ? { data: map(initial), error: null, loading: false } : { data: null, error: null, loading: true });
  // The last raw answer: a refresh that brings the same data back (the usual case for a page prerendered with
  // `initial`) changes nothing, so it doesn't re-render the page.
  const last = useRef(initial ? JSON.stringify(initial) : null);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const raw = await api(path, { auth, url }), key = JSON.stringify(raw);
      if (key === last.current) return setState((s) => (s.loading ? { ...s, loading: false } : s));
      last.current = key;
      setState({ data: map(raw), error: null, loading: false });
    } catch (e) {
      setState((s) => (s.data && initial ? { ...s, loading: false } : { data: null, error: e.message, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, auth, url]);
  // With data already on screen the first fetch is a quiet refresh: no loading state, no re-render for it.
  useEffect(() => { load(!!initial); }, [load]);
  const reload = useCallback(() => load(false), [load]);
  return { ...state, reload };
}
