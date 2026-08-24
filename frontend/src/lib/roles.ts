import { useAuthStore } from "@/store/authStore";

const ADMIN_ROLES = new Set(["ADMIN"]);
const STAFF_ROLES = new Set(["ADMIN", "LIBRARIAN"]);

export function isAdminRole(roleName: string): boolean {
  return ADMIN_ROLES.has(roleName.toUpperCase());
}

export function isStaffRole(roleName: string): boolean {
  return STAFF_ROLES.has(roleName.toUpperCase());
}

export function useIsAdmin(): boolean {
  const user = useAuthStore((state) => state.user);
  return user ? isAdminRole(user.role.name) : false;
}

export function useIsStaff(): boolean {
  const user = useAuthStore((state) => state.user);
  return user ? isStaffRole(user.role.name) : false;
}
