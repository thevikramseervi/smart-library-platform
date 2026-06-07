import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";

const STAFF_ROLES = new Set(["ADMIN", "LIBRARIAN"]);

export function StaffRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const roleName = user.role.name.toUpperCase();
  if (!STAFF_ROLES.has(roleName)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function isStaffRole(roleName: string): boolean {
  return STAFF_ROLES.has(roleName.toUpperCase());
}

export function useIsStaff(): boolean {
  const user = useAuthStore((state) => state.user);
  return user ? isStaffRole(user.role.name) : false;
}
