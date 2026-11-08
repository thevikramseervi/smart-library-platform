import { cn } from "@/lib/utils";
import {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  UserCog,
  Users,
} from "lucide-react";

import { formatDashboardDateTime, formatDashboardDateTimeCompact } from "@/lib/format";
import {
  DASHBOARD_TABLE_CELL_CLASS,
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  DashboardWelcomeHeader,
} from "@/pages/dashboard/components/DashboardShared";
import {
  CirculationActionBadge,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  RoleBadge,
  UserActivityBadge,
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCard
          label="Total users"
          value={data.users_count}
          icon={Users}
          accent="blue"
          to="/admin/users"
          description="Registered platform accounts"
        />
        <DashboardStatCard
          label="Students"
          value={data.students_count}
          icon={GraduationCap}
          accent="green"
          description="Active student accounts"
        />
        <DashboardStatCard
          label="Librarians"
          value={data.librarians_count}
          icon={UserCog}
          accent="sky"
          description="Staff with circulation access"
        />
        <DashboardStatCard
          label="Departments"
          value={data.departments_count}
          icon={Building2}
          accent="indigo"
          to="/admin/departments"
          description="Academic departments configured"
        />
        <DashboardStatCard
          label="Books"
          value={data.books_count}
          icon={BookOpen}
          accent="purple"
          to="/catalog/books"
          description="Titles in the catalog"
        />
        <DashboardStatCard
          label="Active loans"
          value={data.active_loans}
          icon={ClipboardList}
          accent="amber"
          to="/circulation/loans"
          description="Books currently on loan"
        />
      </div>

      <div className="dashboard-activity-grid">
        <DashboardSection
          title="Recent user activity"
          isEmpty={!data.recent_user_activity.length}
          emptyMessage="No user activity recorded."
          emptyIcon={Users}
          compact
          recordCount={data.recent_user_activity.length}
        >
          <CirculationTable
            ariaLabel="Recent user activity"
            mobileContent={data.recent_user_activity.map((activity, index) => (
              <CirculationRecordCard
                key={`${activity.email}-${activity.occurred_at}-${index}`}
                title={activity.user_name}
                subtitle={activity.email}
                status={<UserActivityBadge activityType={activity.activity_type} />}
                fields={[
                  { label: "Role", value: <RoleBadge role={activity.role_name} /> },
                  { label: "When", value: formatDashboardDateTime(activity.occurred_at), wide: true },
                ]}
              />
            ))}
          >
            <CirculationTableHead columns={["Activity", "User", "Role", "When"]} />
            <tbody>
              {data.recent_user_activity.map((activity, index) => (
                <tr key={`${activity.email}-${activity.occurred_at}-${index}`} className="border-b last:border-b-0">
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>
                    <UserActivityBadge activityType={activity.activity_type} />
                  </td>
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>
                    <div className="font-medium">{activity.user_name}</div>
                    <div className="text-muted-foreground">{activity.email}</div>
                  </td>
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>
                    <RoleBadge role={activity.role_name} />
                  </td>
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "whitespace-nowrap")}>
                    <time
                      dateTime={activity.occurred_at}
                      title={formatDashboardDateTime(activity.occurred_at)}
                      aria-label={formatDashboardDateTime(activity.occurred_at)}
                    >
                      {formatDashboardDateTimeCompact(activity.occurred_at)}
                    </time>
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
          emptyIcon={ClipboardList}
          compact
          recordCount={data.recent_circulation_activity.length}
        >
          <CirculationTable
            ariaLabel="Recent circulation activity"
            mobileContent={data.recent_circulation_activity.map((activity, index) => (
              <CirculationRecordCard
                key={`${activity.book_title}-${activity.occurred_at}-${index}`}
                title={activity.book_title}
                status={<CirculationActionBadge action={activity.action} />}
                fields={[
                  { label: "Student", value: activity.student_name },
                  { label: "When", value: formatDashboardDateTime(activity.occurred_at), wide: true },
                ]}
              />
            ))}
          >
            <CirculationTableHead columns={["Action", "Book", "Student", "When"]} />
            <tbody>
              {data.recent_circulation_activity.map((activity, index) => (
                <tr
                  key={`${activity.book_title}-${activity.occurred_at}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>
                    <CirculationActionBadge action={activity.action} />
                  </td>
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "font-medium")}>
                    {activity.book_title}
                  </td>
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>{activity.student_name}</td>
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "whitespace-nowrap")}>
                    <time
                      dateTime={activity.occurred_at}
                      title={formatDashboardDateTime(activity.occurred_at)}
                      aria-label={formatDashboardDateTime(activity.occurred_at)}
                    >
                      {formatDashboardDateTimeCompact(activity.occurred_at)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </DashboardSection>
      </div>

      <DashboardQuickActions
        actions={[
          {
            to: "/admin/users",
            label: "User management",
            description: "Create and manage accounts.",
            icon: Users,
          },
          {
            to: "/admin/departments",
            label: "Department management",
            description: "Maintain academic departments.",
            icon: Building2,
          },
          { to: "/catalog/books", label: "Catalog", description: "Manage books and inventory.", icon: BookOpen },
          {
            to: "/circulation/issue",
            label: "Circulation",
            description: "Issue and return books.",
            icon: ClipboardList,
          },
        ]}
      />
    </section>
  );
}
