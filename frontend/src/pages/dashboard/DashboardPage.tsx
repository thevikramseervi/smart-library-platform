import { useQuery } from "@tanstack/react-query";

import { AdminDashboardView } from "@/pages/dashboard/AdminDashboardView";
import { LibrarianDashboardView } from "@/pages/dashboard/LibrarianDashboardView";
import { StudentDashboardView } from "@/pages/dashboard/StudentDashboardView";
import {
  getAdminDashboard,
  getLibrarianDashboard,
  getStudentDashboard,
} from "@/services/dashboard";
import { useAuthStore } from "@/store/authStore";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const roleName = user?.role.name.toUpperCase() ?? "";

  const studentQuery = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: getStudentDashboard,
    enabled: roleName === "STUDENT",
  });

  const librarianQuery = useQuery({
    queryKey: ["dashboard", "librarian"],
    queryFn: getLibrarianDashboard,
    enabled: roleName === "LIBRARIAN",
  });

  const adminQuery = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: getAdminDashboard,
    enabled: roleName === "ADMIN",
  });

  const activeQuery =
    roleName === "ADMIN" ? adminQuery : roleName === "LIBRARIAN" ? librarianQuery : studentQuery;

  if (!user) {
    return null;
  }

  if (activeQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>;
  }

  if (activeQuery.isError || !activeQuery.data) {
    return <p className="text-sm text-destructive">Unable to load dashboard.</p>;
  }

  if (roleName === "ADMIN") {
    return <AdminDashboardView data={activeQuery.data as Awaited<ReturnType<typeof getAdminDashboard>>} />;
  }

  if (roleName === "LIBRARIAN") {
    return (
      <LibrarianDashboardView
        data={activeQuery.data as Awaited<ReturnType<typeof getLibrarianDashboard>>}
      />
    );
  }

  return (
    <StudentDashboardView data={activeQuery.data as Awaited<ReturnType<typeof getStudentDashboard>>} />
  );
}
