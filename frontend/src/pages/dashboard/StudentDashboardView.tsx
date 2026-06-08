import {
  Bookmark,
  BookOpen,
  CircleDollarSign,
  History,
  Search,
  Sparkles,
} from "lucide-react";

import { formatInr } from "@/lib/formatCurrency";
import {
  BookMarked,
  DASHBOARD_TABLE_CELL_CLASS,
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  DashboardWelcomeHeader,
  formatDashboardDate,
  formatDashboardDateTime,
} from "@/pages/dashboard/components/DashboardShared";
import { cn } from "@/lib/utils";
import {
  CirculationTable,
  CirculationTableHead,
  LoanStatusBadge,
  StatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import type { StudentDashboardResponse } from "@/types/dashboard";

interface StudentDashboardViewProps {
  data: StudentDashboardResponse;
  firstName: string;
}

export function StudentDashboardView({ data, firstName }: StudentDashboardViewProps) {
  const unpaidFinesAmount = Number(data.unpaid_fines);
  const hasUnpaidFines = !Number.isNaN(unpaidFinesAmount) && unpaidFinesAmount > 0;

  return (
    <section className="space-y-8">
      <DashboardWelcomeHeader
        firstName={firstName}
        subtitle="Track your loans, reservations, and fines."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Active loans"
          value={data.active_loans}
          icon={BookMarked}
          accent="amber"
          to="/circulation/my-loans"
          description={
            data.active_loans === 0
              ? "No books currently borrowed"
              : `${data.active_loans} book${data.active_loans === 1 ? "" : "s"} on loan`
          }
        />
        <DashboardStatCard
          label="Active reservations"
          value={data.active_reservations}
          icon={Bookmark}
          accent="indigo"
          tone={data.active_reservations > 0 ? "warning" : "default"}
          to="/circulation/my-reservations"
          description={
            data.active_reservations === 0
              ? "No books waiting in queue"
              : `${data.active_reservations} reservation${data.active_reservations === 1 ? "" : "s"} in queue`
          }
        />
        <DashboardStatCard
          label="Unpaid fines"
          value={formatInr(data.unpaid_fines)}
          icon={CircleDollarSign}
          accent="green"
          tone={hasUnpaidFines ? "danger" : "success"}
          to="/circulation/my-fines"
          description={
            hasUnpaidFines ? "Outstanding balance to settle" : "Great! You have no outstanding fines."
          }
        />
        <DashboardStatCard
          label="Total books borrowed"
          value={data.total_books_borrowed}
          icon={History}
          accent="purple"
          to="/circulation/my-loans"
          description="All-time circulation history"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection
          title="Recent loans"
          isEmpty={!data.recent_loans.length}
          emptyMessage="You're all caught up."
          emptyActionLabel="Browse Catalog"
          emptyActionTo="/catalog/books"
          emptyIcon={Sparkles}
          recordCount={data.recent_loans.length}
        >
          <CirculationTable recordCount={data.recent_loans.length}>
            <CirculationTableHead columns={["Book", "Issued", "Due", "Status"]} />
            <tbody>
              {data.recent_loans.map((loan, index) => (
                <tr key={`${loan.book_title}-${loan.issued_at}-${index}`} className="border-b last:border-b-0">
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "font-medium")}>{loan.book_title}</td>
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "whitespace-nowrap")}>
                    {formatDashboardDate(loan.issued_at)}
                  </td>
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "whitespace-nowrap")}>
                    {formatDashboardDate(loan.due_at)}
                  </td>
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>
                    <LoanStatusBadge status={loan.status} isOverdue={loan.is_overdue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </DashboardSection>

        <DashboardSection
          title="Recent reservations"
          isEmpty={!data.recent_reservations.length}
          emptyMessage="No active reservations."
          emptyActionLabel="Browse Catalog"
          emptyActionTo="/catalog/books"
          emptyIcon={Bookmark}
          recordCount={data.recent_reservations.length}
        >
          <CirculationTable recordCount={data.recent_reservations.length}>
            <CirculationTableHead columns={["Book", "Queue", "Reserved"]} />
            <tbody>
              {data.recent_reservations.map((reservation, index) => (
                <tr
                  key={`${reservation.book_title}-${reservation.reservation_date}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "font-medium")}>
                    {reservation.book_title}
                  </td>
                  <td className={DASHBOARD_TABLE_CELL_CLASS}>
                    {reservation.queue_position != null ? (
                      <StatusBadge label={`#${reservation.queue_position}`} variant="warning" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "whitespace-nowrap")}>
                    {formatDashboardDateTime(reservation.reservation_date)}
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
            to: "/catalog/books",
            label: "Browse catalog",
            description: "Search and view books.",
            icon: Search,
          },
          {
            to: "/circulation/my-loans",
            label: "My loans",
            description: "Review current and past loans.",
            icon: BookOpen,
          },
          {
            to: "/circulation/my-reservations",
            label: "My reservations",
            description: "Check reservation queue positions.",
            icon: Bookmark,
          },
          {
            to: "/circulation/my-fines",
            label: "My fines",
            description: "View unpaid and paid fines.",
            icon: CircleDollarSign,
          },
        ]}
      />
    </section>
  );
}
