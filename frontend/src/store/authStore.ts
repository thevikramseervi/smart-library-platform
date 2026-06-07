import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { UserResponse } from "@/types/api";

interface AuthState {
  token: string | null;
  user: UserResponse | null;
  setAuth: (token: string, user: UserResponse) => void;
  setUser: (user: UserResponse) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: "smart-library-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
