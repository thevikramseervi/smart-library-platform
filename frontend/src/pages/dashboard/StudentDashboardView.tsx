import { formatInr } from "@/lib/formatCurrency";
import {
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  DashboardWelcomeHeader,
  formatDashboardDate,
  formatDashboardDateTime,
} from "@/pages/dashboard/components/DashboardShared";
import {
  CirculationTable,
  CirculationTableHead,
  StatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import type { StudentDashboardResponse } from "@/types/dashboard";

interface StudentDashboardViewProps {
  data: StudentDashboardResponse;
  firstName: string;
}

function getLoanStatusBadge(loan: StudentDashboardResponse["recent_loans"][number]) {
  if (loan.is_overdue) {
    return <StatusBadge label="Overdue" variant="danger" />;
  }
  if (loan.status === "RETURNED") {
    return <StatusBadge label="Returned" variant="success" />;
  }
  return <StatusBadge label="On loan" variant="default" />;
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Active loans"
          value={data.active_loans}
          description={
            data.active_loans === 0
              ? "No books currently borrowed"
              : `${data.active_loans} book${data.active_loans === 1 ? "" : "s"} on loan`
          }
        />
        <DashboardStatCard
          label="Active reservations"
          value={data.active_reservations}
          tone={data.active_reservations > 0 ? "warning" : "default"}
          description={
            data.active_reservations === 0
              ? "No books waiting in queue"
              : `${data.active_reservations} reservation${data.active_reservations === 1 ? "" : "s"} in queue`
          }
        />
        <DashboardStatCard
          label="Unpaid fines"
          value={formatInr(data.unpaid_fines)}
          tone={hasUnpaidFines ? "danger" : "success"}
          description={
            hasUnpaidFines ? "Outstanding balance to settle" : "Great! You have no outstanding fines."
          }
        />
        <DashboardStatCard
          label="Total books borrowed"
          value={data.total_books_borrowed}
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
        >
          <CirculationTable>
            <CirculationTableHead columns={["Book", "Issued", "Due", "Status"]} sticky />
            <tbody>
              {data.recent_loans.map((loan, index) => (
                <tr key={`${loan.book_title}-${loan.issued_at}-${index}`} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{loan.book_title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDashboardDate(loan.issued_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDashboardDate(loan.due_at)}</td>
                  <td className="px-4 py-3">{getLoanStatusBadge(loan)}</td>
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
        >
          <CirculationTable>
            <CirculationTableHead columns={["Book", "Queue", "Reserved"]} sticky />
            <tbody>
              {data.recent_reservations.map((reservation, index) => (
                <tr
                  key={`${reservation.book_title}-${reservation.reservation_date}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{reservation.book_title}</td>
                  <td className="px-4 py-3">
                    {reservation.queue_position != null ? (
                      <StatusBadge label={`#${reservation.queue_position}`} variant="warning" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
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
          { to: "/catalog/books", label: "Browse catalog", description: "Search and view books." },
          { to: "/circulation/my-loans", label: "My loans", description: "Review current and past loans." },
          {
            to: "/circulation/my-reservations",
            label: "My reservations",
            description: "Check reservation queue positions.",
          },
          { to: "/circulation/my-fines", label: "My fines", description: "View unpaid and paid fines." },
        ]}
      />
    </section>
  );
}
