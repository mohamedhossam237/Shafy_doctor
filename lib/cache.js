// /lib/cache.js

const SESSION_PREFIX = 'shafy_doc_cache_v2_';

export function readSessionCache(key, maxAgeMs = 5 * 60 * 1000) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (maxAgeMs && parsed.ts && Date.now() - parsed.ts > maxAgeMs) {
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeSessionCache(key, data) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      SESSION_PREFIX + key,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function clearSessionCache() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {}
}

const globalCache = {
  authorizedUid: null,
  doctorProfile: null,
  dashboard: null,
  appointments: null,
  history: null,
  patients: null,
  moreCounts: null,
  unreadCounts: { notifications: 0, messages: 0 },
  clear() {
    this.authorizedUid = null;
    this.doctorProfile = null;
    this.dashboard = null;
    this.appointments = null;
    this.history = null;
    this.patients = null;
    this.moreCounts = null;
    this.unreadCounts = { notifications: 0, messages: 0 };
    clearSessionCache();
  },
};

export default globalCache;
