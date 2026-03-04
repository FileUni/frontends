import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageHub } from '@fileuni/shared';

interface User {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role_id: number;
}

export interface AuthData {
  user: User;
  access_token: string;
  refresh_token: string;
  login_time: string;
}

interface AuthState {
  usersMap: Record<string, AuthData>;
  currentUserId: string | null;
  currentUserData: AuthData | null;
  isLoggedIn: boolean;
  mustChangePassword: boolean;
  mustChangePasswordDismissed: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  saveLoginInfo: (authData: AuthData, mustChange?: boolean) => void;
  setMustChangePassword: (must: boolean) => void;
  setMustChangePasswordDismissed: (dismissed: boolean) => void;
  switchUser: (userId: string) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: (userId?: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usersMap: {},
      currentUserId: null,
      currentUserData: null,
      isLoggedIn: false,
      mustChangePassword: false,
      mustChangePasswordDismissed: false,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      saveLoginInfo: (authData, mustChange = false) => {
        const { user } = authData;
        const login_time = new Date().toISOString();
        const updatedAuthData = { ...authData, login_time };
        
        const newMap = { ...get().usersMap };
        // Always save to map, if remember is false, handle it at logout
        newMap[user.id] = updatedAuthData;

        set({
          usersMap: newMap,
          currentUserId: user.id,
          currentUserData: updatedAuthData,
          isLoggedIn: true,
          mustChangePassword: mustChange,
          mustChangePasswordDismissed: false // Reset dismissal state
        });
      },

      setMustChangePassword: (must) => set({ mustChangePassword: must }),
      
      setMustChangePasswordDismissed: (dismissed) => set({ mustChangePasswordDismissed: dismissed }),

      updateTokens: (accessToken, refreshToken) => {
        const { currentUserId, usersMap, currentUserData } = get();
        if (!currentUserId || !currentUserData) return;

        const updatedData = {
          ...currentUserData,
          access_token: accessToken,
          refresh_token: refreshToken
        };

        const newMap = { ...usersMap };
        newMap[currentUserId] = updatedData;

        set({
          currentUserData: updatedData,
          usersMap: newMap
        });
      },

      switchUser: (userId) => {
        const user = get().usersMap[userId];
        if (user) {
          set({
            currentUserId: userId,
            currentUserData: user,
            isLoggedIn: true
          });
        }
      },

      logout: (userId) => {
        const idToRemove = (userId || get().currentUserId) as string;
        if (!idToRemove) return;

        const newMap = { ...get().usersMap };
        delete newMap[idToRemove];

        let nextId: string | null = get().currentUserId;
        let nextData: AuthData | null = get().currentUserData;
        
        if (idToRemove === get().currentUserId) {
          const remainingIds = Object.keys(newMap);
          nextId = remainingIds.length > 0 ? (remainingIds[0] as string) : null;
          nextData = nextId ? (newMap[nextId] || null) : null;
        }

        set({
          usersMap: newMap,
          currentUserId: nextId,
          currentUserData: nextData,
          isLoggedIn: !!nextId,
          mustChangePassword: false,
          mustChangePasswordDismissed: false
        });
      },
    }),
    {
      name: 'fileuni-auth',
      storage: createJSONStorage(() => storageHub.createZustandStorage()),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
