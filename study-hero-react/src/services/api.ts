const API_BASE_URL = process.env.REACT_APP_API_URL;

export const getAuthToken = () => localStorage.getItem('authToken');
export const setAuthToken = (token: string) => localStorage.setItem('authToken', token);

export interface AuthPayload {
  userId?: number;
  id?: number;
  role?: string;
  exp?: number;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  emailVerified?: boolean;
}

export interface AuthResponse {
  token: string;
  accessToken?: string;
  expiresIn?: string;
  user: AuthUser;
  requiresEmailVerification?: boolean;
  message?: string;
}

export const decodeAuthToken = (): AuthPayload | null => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(normalized));
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

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!API_BASE_URL) throw new Error('API URL is not configured');

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    clearAuthToken();
    return null;
  }

  const data = await parseResponse(response) as AuthResponse;
  const token = data.accessToken || data.token;
  if (token) setAuthToken(token);
  return token || null;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
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
    credentials: 'include',
    headers,
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String((data as any).error)
      : typeof data === 'object' && data && 'message' in data
        ? String((data as any).message)
        : 'Request failed';
    const details = typeof data === 'object' && data && 'details' in data ? (data as any).details : undefined;
    const error = new Error(message) as Error & { details?: any };
    error.details = details;
    throw error;
  }

  return data as T;
}

export async function login(email: string, password: string, rememberMe: boolean): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe })
  }, false);
  setAuthToken(data.accessToken || data.token);
  return data;
}

export async function register(payload: { username: string; email: string; password: string; role: string }) {
  return apiRequest<{ message: string; requiresEmailVerification?: boolean }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, false);
}

export async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' }, false);
  } finally {
    clearAuthToken();
  }
}

export async function logoutAll() {
  try {
    await apiRequest('/api/auth/logout-all', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}
export async function forgotPassword(email: string) {
  return apiRequest<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  }, false);
}

export async function resetPassword(token: string, password: string) {
  return apiRequest<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password })
  }, false);
}

export async function verifyEmail(token: string) {
  return apiRequest<{ message: string }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token })
  }, false);
}

export async function resendVerification(email: string) {
  return apiRequest<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  }, false);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
}