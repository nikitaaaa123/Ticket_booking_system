// Frontend API client configuration
// If VITE_API_BASE_URL is defined, use it; otherwise fallback to relative path (standard for same-domain Express Vite setup)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...restOptions } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const storedToken = token || localStorage.getItem('tbs_token');
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP Error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// WebSocket URL helper
export function getWebSocketUrl(): string {
  const customWs = import.meta.env.VITE_WS_BASE_URL;
  if (customWs) return customWs;

  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${loc.host}/ws`;
}
