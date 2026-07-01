const API_BASE_URL = process.env.REACT_APP_API_URL;

export const getAuthToken = () => localStorage.getItem('authToken');

export interface AuthPayload {
  userId?: number;
  id?: number;
  role?: string;
  exp?: number;
}

export const decodeAuthToken = (): AuthPayload | null => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(window.atob(normalized));
    return decoded;
  } catch (error) {
    console.error('Unable to decode auth token:', error);
    return null;
  }
};

export const getAuthRole = () => decodeAuthToken()?.role || null;

export const isTokenExpired = () => {
  const payload = decodeAuthToken();
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
};

export const clearAuthToken = () => {
  localStorage.removeItem('authToken');
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('API URL is not configured');
  }

  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String((data as any).error)
      : typeof data === 'object' && data && 'message' in data
        ? String((data as any).message)
        : 'Request failed';
    throw new Error(message);
  }

  return data as T;
}