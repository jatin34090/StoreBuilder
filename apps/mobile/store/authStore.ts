import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  role: string | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  login: (token: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  role: null,
  isAuthenticated: false,

  setAccessToken: (token) => set({ accessToken: token }),

  login: async (token, refreshToken, user) => {
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    set({ accessToken: token, user, role: user.role, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('refresh_token');
    set({ accessToken: null, user: null, role: null, isAuthenticated: false });
  },
}));
