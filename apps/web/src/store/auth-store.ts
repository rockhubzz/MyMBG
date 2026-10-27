import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'Admin' | 'KepalaDapur' | 'Staff';

export interface AuthUser {
  id:    string;
  nama:  string;
  email: string;
  role:  UserRole;
}

interface AuthState {
  token:     string | null;
  user:      AuthUser | null;
  isAuth:    boolean;
  setAuth:   (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:   null,
      user:    null,
      isAuth:  false,

      setAuth: (token, user) =>
        set({ token, user, isAuth: true }),

      clearAuth: () =>
        set({ token: null, user: null, isAuth: false }),
    }),
    {
      name:    'mbg-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user, isAuth: s.isAuth }),
    }
  )
);