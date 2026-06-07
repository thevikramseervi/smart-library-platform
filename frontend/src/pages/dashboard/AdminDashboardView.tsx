import {
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  DashboardWelcomeHeader,
  formatDashboardDateTime,
} from "@/pages/dashboard/components/DashboardShared";
import {
  CirculationTable,
  CirculationTableHead,
  StatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import type { AdminDashboardResponse } from "@/types/dashboard";

interface AdminDashboardViewProps {
  data: AdminDashboardResponse;
  firstName: string;
}

export function AdminDashboardView({ data, firstName }: AdminDashboardViewProps) {
  return (
    <section className="space-y-8">
      <DashboardWelcomeHeader
        firstName={firstName}
        subtitle="Manage users, catalog resources, and platform activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard
          label="Total users"
          value={data.users_count}
          description="Registered platform accounts"
        />
        <DashboardStatCard
          label="Students"
          value={data.students_count}
          description="Active student accounts"
        />
        <DashboardStatCard
          label="Librarians"
          value={data.librarians_count}
          description="Staff with circulation access"
        />
        <DashboardStatCard
          label="Departments"
          value={data.departments_count}
          description="Academic departments configured"
        />
        <DashboardStatCard
          label="Books"
          value={data.books_count}
          description="Titles in the catalog"
        />
        <DashboardStatCard
          label="Active loans"
          value={data.active_loans}
          description="Books currently on loan"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection
          title="Recent user activity"
          isEmpty={!data.recent_user_activity.length}
          emptyMessage="No user activity recorded."
          compact
        >
          <CirculationTable>
            <CirculationTableHead columns={["Activity", "User", "Role", "When"]} sticky />
            <tbody>
              {data.recent_user_activity.map((activity, index) => (
                <tr key={`${activity.email}-${activity.occurred_at}-${index}`} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={activity.activity_type === "CREATED" ? "Created" : "Deactivated"}
                      variant={activity.activity_type === "CREATED" ? "success" : "warning"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{activity.user_name}</div>
                    <div className="text-muted-foreground">{activity.email}</div>
                  </td>
                  <td className="px-4 py-3">{activity.role_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDashboardDateTime(activity.occurred_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </DashboardSection>

        <DashboardSection
          title="Recent circulation activity"
          isEmpty={!data.recent_circulation_activity.length}
          emptyMessage="No recent circulation events."
          compact
        >
          <CirculationTable>
            <CirculationTableHead columns={["Action", "Book", "Student", "When"]} sticky />
            <tbody>
              {data.recent_circulation_activity.map((activity, index) => (
                <tr
                  key={`${activity.book_title}-${activity.occurred_at}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={activity.action === "ISSUE" ? "Issue" : "Return"}
                      variant={activity.action === "RETURN" ? "success" : "default"}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{activity.book_title}</td>
                  <td className="px-4 py-3">{activity.student_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDashboardDateTime(activity.occurred_at)}
                  </td>
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
