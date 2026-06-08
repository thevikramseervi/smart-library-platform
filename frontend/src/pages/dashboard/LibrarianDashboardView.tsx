import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  BookOpen,
  CircleDollarSign,
  ClipboardList,
  Layers,
  LogIn,
  LogOut,
  Search,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DASHBOARD_TABLE_CELL_CLASS,
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  DashboardWelcomeHeader,
  formatDashboardDateTime,
} from "@/pages/dashboard/components/DashboardShared";
import {
  CirculationActionBadge,
  CirculationTable,
  CirculationTableHead,
} from "@/pages/circulation/components/CirculationShared";
import type { LibrarianDashboardResponse } from "@/types/dashboard";

interface LibrarianDashboardViewProps {
  data: LibrarianDashboardResponse;
  firstName: string;
}

export function LibrarianDashboardView({ data, firstName }: LibrarianDashboardViewProps) {
  return (
    <section className="space-y-8">
      <DashboardWelcomeHeader
        firstName={firstName}
        subtitle="Monitor circulation activity and manage library operations."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCard
          label="Total books"
          value={data.books_count}
          icon={BookOpen}
          accent="purple"
          to="/catalog/books"
          description="Titles in the catalog"
        />
        <DashboardStatCard
          label="Total copies"
          value={data.copies_count}
          icon={Layers}
          accent="indigo"
          description="Physical copies available for circulation"
        />
        <DashboardStatCard
          label="Active loans"
          value={data.active_loans}
          icon={ClipboardList}
          accent="amber"
          to="/circulation/return"
          description={
            data.active_loans === 0 ? "No books currently on loan" : "Books currently borrowed"
          }
        />
        <DashboardStatCard
          label="Overdue loans"
          value={data.overdue_loans}
          icon={AlertTriangle}
          accent="amber"
          tone={data.overdue_loans > 0 ? "danger" : "success"}
          to="/circulation/overdue"
          description={
            data.overdue_loans === 0 ? "All loans returned on time" : "Loans past their due date"
          }
        />
        <DashboardStatCard
          label="Active reservations"
          value={data.reservations_count}
          icon={Bookmark}
          accent="blue"
          tone={data.reservations_count > 0 ? "warning" : "default"}
          to="/circulation/reservations"
          description="Students waiting for available copies"
        />
        <DashboardStatCard
          label="Unpaid fines"
          value={data.unpaid_fines_count}
          icon={CircleDollarSign}
          accent="green"
          tone={data.unpaid_fines_count > 0 ? "danger" : "success"}
          to="/circulation/fines"
          description={
            data.unpaid_fines_count === 0
              ? "No outstanding fine records"
              : "Open fine records awaiting payment"
          }
        />
      </div>

      <DashboardSection
        title="Recent transactions"
        isEmpty={!data.recent_transactions.length}
        emptyMessage="No circulation activity yet."
        emptyIcon={ArrowLeftRight}
        recordCount={data.recent_transactions.length}
      >
        <CirculationTable recordCount={data.recent_transactions.length}>
          <CirculationTableHead columns={["Book", "Student", "Action", "Date"]} />
          <tbody>
            {data.recent_transactions.map((transaction, index) => (
              <tr
                key={`${transaction.book_title}-${transaction.occurred_at}-${index}`}
                className="border-b last:border-b-0"
              >
                <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "font-medium")}>
                  {transaction.book_title}
                </td>
                <td className={DASHBOARD_TABLE_CELL_CLASS}>
                  {transaction.student_name}
                  {transaction.student_code ? ` (${transaction.student_code})` : ""}
                </td>
                <td className={DASHBOARD_TABLE_CELL_CLASS}>
                  <CirculationActionBadge action={transaction.action} />
                </td>
                <td className={cn(DASHBOARD_TABLE_CELL_CLASS, "whitespace-nowrap")}>
                  {formatDashboardDateTime(transaction.occurred_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </CirculationTable>
      </DashboardSection>

      <DashboardQuickActions
        actions={[
          { to: "/circulation/issue", label: "Issue book", description: "Create a new loan.", icon: LogIn },
          { to: "/circulation/return", label: "Return book", description: "Process a book return.", icon: LogOut },
          { to: "/catalog/books", label: "Catalog", description: "Manage books and copies.", icon: Search },
          {
            to: "/circulation/reservations",
            label: "Reservations",
            description: "Review reservation queues.",
            icon: Bookmark,
          },
          { to: "/circulation/fines", label: "Fines", description: "Review and mark fines paid.", icon: CircleDollarSign },
        ]}
      />
    </section>
  );
}
