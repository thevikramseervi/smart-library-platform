import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";

/**
 * Terminate the session completely.
 *
 * Clears persisted credentials, wipes every cached server response so data
 * from the signed-out user can never render for the next one, and performs a
 * full page load so all in-memory application state is discarded.
 */
export function logout(): void {
  useAuthStore.getState().clearAuth();
  queryClient.clear();
  window.location.assign("/login");
}
