import { AuthUser } from '@/store/auth-store';
import { apiClient } from '@/lib/api/client';

interface LoginResponse {
  token: string;
  user:  AuthUser;
}

// ── Auth API ─────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    }),

  register: (nama: string, email: string, password: string) =>
    apiClient<LoginResponse>('/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ nama, email, password }),
    }),
};