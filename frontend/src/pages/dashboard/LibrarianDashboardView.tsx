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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard
          label="Total books"
          value={data.books_count}
          description="Titles in the catalog"
        />
        <DashboardStatCard
          label="Total copies"
          value={data.copies_count}
          description="Physical copies available for circulation"
        />
        <DashboardStatCard
          label="Active loans"
          value={data.active_loans}
          description={
            data.active_loans === 0 ? "No books currently on loan" : "Books currently borrowed"
          }
        />
        <DashboardStatCard
          label="Overdue loans"
          value={data.overdue_loans}
          tone={data.overdue_loans > 0 ? "danger" : "success"}
          description={
            data.overdue_loans === 0 ? "All loans returned on time" : "Loans past their due date"
          }
        />
        <DashboardStatCard
          label="Active reservations"
          value={data.reservations_count}
          tone={data.reservations_count > 0 ? "warning" : "default"}
          description="Students waiting for available copies"
        />
        <DashboardStatCard
          label="Unpaid fines"
          value={data.unpaid_fines_count}
          tone={data.unpaid_fines_count > 0 ? "danger" : "success"}
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
      >
        <CirculationTable>
          <CirculationTableHead columns={["Book", "Student", "Action", "Date"]} sticky />
          <tbody>
            {data.recent_transactions.map((transaction, index) => (
              <tr
                key={`${transaction.book_title}-${transaction.occurred_at}-${index}`}
                className="border-b last:border-b-0"
              >
                <td className="px-4 py-3 font-medium">{transaction.book_title}</td>
                <td className="px-4 py-3">
                  {transaction.student_name}
                  {transaction.student_code ? ` (${transaction.student_code})` : ""}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={transaction.action === "ISSUE" ? "Issue" : "Return"}
                    variant={transaction.action === "RETURN" ? "success" : "default"}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDashboardDateTime(transaction.occurred_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </CirculationTable>
      </DashboardSection>

      <DashboardQuickActions
        actions={[
          { to: "/circulation/issue", label: "Issue book", description: "Create a new loan." },
          { to: "/circulation/return", label: "Return book", description: "Process a book return." },
          { to: "/catalog/books", label: "Catalog", description: "Manage books and copies." },
          {
            to: "/circulation/reservations",
            label: "Reservations",
            description: "Review reservation queues.",
          },
          { to: "/circulation/fines", label: "Fines", description: "Review and mark fines paid." },
        ]}
      />
    </section>
  );
}
