import {
  DashboardPageHeader,
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  formatDashboardDateTime,
} from "@/pages/dashboard/components/DashboardShared";
import {
  CirculationTable,
  CirculationTableHead,
} from "@/pages/circulation/components/CirculationShared";
import type { AdminDashboardResponse } from "@/types/dashboard";

interface AdminDashboardViewProps {
  data: AdminDashboardResponse;
}

export function AdminDashboardView({ data }: AdminDashboardViewProps) {
  return (
    <section className="space-y-8">
      <DashboardPageHeader
        title="Admin Dashboard"
        description="Overview of users, catalog size, and recent platform activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard label="Total users" value={data.users_count} />
        <DashboardStatCard label="Students" value={data.students_count} />
        <DashboardStatCard label="Librarians" value={data.librarians_count} />
        <DashboardStatCard label="Departments" value={data.departments_count} />
        <DashboardStatCard label="Books" value={data.books_count} />
        <DashboardStatCard label="Active loans" value={data.active_loans} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection
          title="Recent user activity"
          isEmpty={!data.recent_user_activity.length}
          emptyMessage="No recent user changes."
        >
          <CirculationTable>
            <CirculationTableHead columns={["Activity", "User", "Role", "When"]} />
            <tbody>
              {data.recent_user_activity.map((activity, index) => (
                <tr key={`${activity.email}-${activity.occurred_at}-${index}`} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    {activity.activity_type === "CREATED" ? "Created" : "Deactivated"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{activity.user_name}</div>
                    <div className="text-muted-foreground">{activity.email}</div>
                  </td>
                  <td className="px-4 py-3">{activity.role_name}</td>
                  <td className="px-4 py-3">{formatDashboardDateTime(activity.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </DashboardSection>

        <DashboardSection
          title="Recent circulation activity"
          isEmpty={!data.recent_circulation_activity.length}
          emptyMessage="No recent circulation events."
        >
          <CirculationTable>
            <CirculationTableHead columns={["Action", "Book", "Student", "When"]} />
            <tbody>
              {data.recent_circulation_activity.map((activity, index) => (
                <tr
                  key={`${activity.book_title}-${activity.occurred_at}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3">{activity.action === "ISSUE" ? "Issue" : "Return"}</td>
                  <td className="px-4 py-3 font-medium">{activity.book_title}</td>
                  <td className="px-4 py-3">{activity.student_name}</td>
                  <td className="px-4 py-3">{formatDashboardDateTime(activity.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </DashboardSection>
      </div>

      <DashboardQuickActions
        actions={[
          { to: "/admin/users", label: "User management", description: "Create and manage accounts." },
          {
            to: "/admin/departments",
            label: "Department management",
            description: "Maintain academic departments.",
          },
          { to: "/catalog/books", label: "Catalog", description: "Manage books and inventory." },
          { to: "/circulation/issue", label: "Circulation", description: "Issue and return books." },
        ]}
      />
    </section>
  );
}
