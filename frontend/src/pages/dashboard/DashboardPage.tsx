import { useQuery } from "@tanstack/react-query";

import { AdminDashboardView } from "@/pages/dashboard/AdminDashboardView";
import { LibrarianDashboardView } from "@/pages/dashboard/LibrarianDashboardView";
import { StudentDashboardView } from "@/pages/dashboard/StudentDashboardView";
import { DashboardLoadingSkeleton } from "@/pages/dashboard/components/DashboardShared";
import {
  getAdminDashboard,
  getLibrarianDashboard,
  getStudentDashboard,
} from "@/services/dashboard";
import { useAuthStore } from "@/store/authStore";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const roleName = user?.role.name.toUpperCase() ?? "";
  const firstName = user?.first_name ?? "there";

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
    if (roleName === "ADMIN") {
      return (
        <DashboardLoadingSkeleton
          statCount={6}
          statGridClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          sectionCount={2}
        />
      );
    }
    if (roleName === "LIBRARIAN") {
      return (
        <DashboardLoadingSkeleton
          statCount={6}
          statGridClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          sectionCount={1}
        />
      );
    }
    return (
      <DashboardLoadingSkeleton
        statCount={4}
        statGridClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4"
        sectionCount={2}
      />
    );
  }

  if (activeQuery.isError || !activeQuery.data) {
    return <p className="text-sm text-destructive">Unable to load dashboard.</p>;
  }

  if (roleName === "ADMIN") {
    return (
      <AdminDashboardView
        data={activeQuery.data as Awaited<ReturnType<typeof getAdminDashboard>>}
        firstName={firstName}
      />
    );
  }

  if (roleName === "LIBRARIAN") {
    return (
      <LibrarianDashboardView
        data={activeQuery.data as Awaited<ReturnType<typeof getLibrarianDashboard>>}
        firstName={firstName}
      />
    );
  }

  return (
    <StudentDashboardView
      data={activeQuery.data as Awaited<ReturnType<typeof getStudentDashboard>>}
      firstName={firstName}
    />
  );
}
