import { Navigate, Outlet } from "react-router-dom";

import { isStaffRole } from "@/lib/roles";
import { useAuthStore } from "@/store/authStore";

export function StaffRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isStaffRole(user.role.name)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
