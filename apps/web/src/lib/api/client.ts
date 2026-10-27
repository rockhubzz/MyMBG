import { useAuthStore } from '@/store/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    const token = useAuthStore.getState().token;

    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    res = await fetch(`/api${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Tidak bisa terhubung ke API (${API_BASE_URL}).`);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.message ??
      body?.detail ??
      body?.title ??
      `Request gagal (${res.status})`;
    throw new Error(msg);
  }

  return body as T;
}
