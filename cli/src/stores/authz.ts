import { create } from "zustand";
import { client, extractData, isApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export interface UserEntitlements {
  user_id: string;
  role_id: number;
  effective_permissions: string[];
  allow_overrides: string[];
  deny_overrides: string[];
}

interface AuthzState {
  entitlements: UserEntitlements | null;
  isLoading: boolean;
  fetchEntitlements: () => Promise<void>;
  clear: () => void;
  hasPermission: (permissionKey: string) => boolean;
}

export const useAuthzStore = create<AuthzState>((set, get) => ({
  entitlements: null,
  isLoading: false,
  fetchEntitlements: async () => {
    const { isLoggedIn, currentUserData } = useAuthStore.getState();
    if (!isLoggedIn || !currentUserData) {
      set({ entitlements: null, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const data = await extractData<UserEntitlements>(
        client.GET("/api/v1/users/auth/me/entitlements")
      );
      set({ entitlements: data });
    } catch (error) {
      if (!isApiError(error)) {
        console.error("Failed to fetch entitlements", error);
      }
      set({ entitlements: null });
    } finally {
      set({ isLoading: false });
    }
  },
  clear: () => set({ entitlements: null, isLoading: false }),
  hasPermission: (permissionKey: string) => {
    const entitlements = get().entitlements;
    
    // If entitlements not fetched yet, fallback to authStore's role_id for superadmin check
    const authUser = useAuthStore.getState().currentUserData?.user;
    if (authUser && authUser.role_id === 0) {
      return true;
    }

    if (!entitlements) {
      return false;
    }

    if (entitlements.role_id === 0) {
      return true;
    }
    return entitlements.effective_permissions.includes(permissionKey);
  },
}));
