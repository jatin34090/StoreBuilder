import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'agent_access_token';
const USER_KEY = 'agent_user';

export interface AgentUser {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  avatar?: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AgentUser | null;
  role: string | null;
  isAuthenticated: boolean;
  /** True once restoreSession() has run — gates routing until storage is read. */
  hydrated: boolean;

  setAccessToken: (token: string) => void;
  login: (token: string, user: AgentUser) => Promise<void>;
  restoreSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  role: null,
  isAuthenticated: false,
  hydrated: false,

  setAccessToken: (token) => set({ accessToken: token }),

  login: async (token, user) => {
    // The backend's refresh token is an HttpOnly cookie unavailable to the
    // mobile client, so we persist the access token itself and re-authenticate
    // via OTP when it expires.
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ accessToken: token, user, role: user.role, isAuthenticated: true });
  },

  restoreSession: async () => {
    try {
      const [token, userRaw] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token && userRaw) {
        const user = JSON.parse(userRaw) as AgentUser;
        set({ accessToken: token, user, role: user.role, isAuthenticated: true });
      }
    } catch {
      // Corrupt/locked storage — fall through to unauthenticated.
    } finally {
      set({ hydrated: true });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    set({ accessToken: null, user: null, role: null, isAuthenticated: false });
    // hydrated stays true — we already know storage state.
    void get;
  },
}));
