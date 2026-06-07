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
import type { LibrarianDashboardResponse } from "@/types/dashboard";

interface LibrarianDashboardViewProps {
  data: LibrarianDashboardResponse;
}

export function LibrarianDashboardView({ data }: LibrarianDashboardViewProps) {
  return (
    <section className="space-y-8">
      <DashboardPageHeader
        title="Librarian Dashboard"
        description="Monitor circulation activity and jump into daily library operations."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard label="Total books" value={data.books_count} />
        <DashboardStatCard label="Total copies" value={data.copies_count} />
        <DashboardStatCard label="Active loans" value={data.active_loans} />
        <DashboardStatCard label="Overdue loans" value={data.overdue_loans} />
        <DashboardStatCard label="Active reservations" value={data.reservations_count} />
        <DashboardStatCard label="Unpaid fines" value={data.unpaid_fines_count} hint="Open fine records" />
      </div>

      <DashboardSection
        title="Recent transactions"
        isEmpty={!data.recent_transactions.length}
        emptyMessage="No circulation activity recorded yet."
      >
        <CirculationTable>
          <CirculationTableHead columns={["Book", "Student", "Action", "Date"]} />
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
                <td className="px-4 py-3">{transaction.action === "ISSUE" ? "Issue" : "Return"}</td>
                <td className="px-4 py-3">{formatDashboardDateTime(transaction.occurred_at)}</td>
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
