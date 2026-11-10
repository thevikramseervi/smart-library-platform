import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/services/auth";
import { logout } from "@/lib/session";
import { useAuthStore } from "@/store/authStore";

export function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasRole = Boolean(user?.role?.name);
  const restoreProfileQuery = useQuery({
    queryKey: ["auth", "restore-profile"],
    queryFn: async () => {
      const currentUser = await getCurrentUser();
      useAuthStore.getState().setUser(currentUser);
      return currentUser;
    },
    enabled: Boolean(token) && !hasRole,
    retry: false,
    staleTime: Infinity,
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole) {
    if (restoreProfileQuery.isError) {
      return (
        <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
          <h1 className="text-xl font-semibold">Your session needs refreshing</h1>
          <p className="text-sm text-muted-foreground">
            We couldn’t restore your account details. Sign in again to continue.
          </p>
          <Button onClick={logout}>Sign in again</Button>
        </main>
      );
    }

    return (
      <main role="status" className="mx-auto flex min-h-svh max-w-lg items-center justify-center px-5 text-sm text-muted-foreground">
        Restoring your account details…
      </main>
    );
  }

  return <Outlet />;
}
