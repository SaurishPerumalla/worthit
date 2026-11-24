import { Capacitor } from '@capacitor/core';

const DEFAULT_NATIVE_API_URL = 'https://worthit-5gvp.onrender.com';

/**
 * Resolves the API base URL.
 * On web, returns '' so requests use same-origin `/api/...`.
 * On native Capacitor iOS/Android builds, points to the live Render backend.
 */
export function getApiBaseUrl(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (Capacitor.isNativePlatform()) {
    return DEFAULT_NATIVE_API_URL;
  }

  return '';
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}
