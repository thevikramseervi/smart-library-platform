import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";

const ADMIN_ROLES = new Set(["ADMIN"]);

export function AdminRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!ADMIN_ROLES.has(user.role.name.toUpperCase())) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function isAdminRole(roleName: string): boolean {
  return ADMIN_ROLES.has(roleName.toUpperCase());
}

export function useIsAdmin(): boolean {
  const user = useAuthStore((state) => state.user);
  return user ? isAdminRole(user.role.name) : false;
}
