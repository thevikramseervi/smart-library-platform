import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/services/api";
import { toast } from "sonner";

/**
 * Terminate the session completely.
 *
 * Clears persisted credentials, wipes every cached server response so data
 * from the signed-out user can never render for the next one, and performs a
 * full page load so all in-memory application state is discarded.
 */
export async function logout(): Promise<void> {
  if (useAuthStore.getState().token) {
    try {
      await api.post("/auth/logout", undefined, { timeout: 10000 });
    } catch {
      toast.error("Could not sign out. Please check your connection and try again.");
      return;
    }
  }
  useAuthStore.getState().clearAuth();
  queryClient.clear();
  window.location.assign("/login");
}
