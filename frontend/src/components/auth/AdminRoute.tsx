import { Navigate, Outlet } from "react-router-dom";

import { isAdminRole } from "@/lib/roles";
import { useAuthStore } from "@/store/authStore";

export function AdminRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user?.role?.name) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminRole(user.role.name)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
