import { formatInr } from "@/lib/formatCurrency";
import {
  DashboardPageHeader,
  DashboardQuickActions,
  DashboardSection,
  DashboardStatCard,
  formatDashboardDate,
  formatDashboardDateTime,
} from "@/pages/dashboard/components/DashboardShared";
import {
  CirculationTable,
  CirculationTableHead,
} from "@/pages/circulation/components/CirculationShared";
import type { StudentDashboardResponse } from "@/types/dashboard";

interface StudentDashboardViewProps {
  data: StudentDashboardResponse;
}

export function StudentDashboardView({ data }: StudentDashboardViewProps) {
  return (
    <section className="space-y-8">
      <DashboardPageHeader
        title="Student Dashboard"
        description="Track your loans, reservations, and fines at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label="Active loans" value={data.active_loans} />
        <DashboardStatCard label="Active reservations" value={data.active_reservations} />
        <DashboardStatCard label="Unpaid fines" value={formatInr(data.unpaid_fines)} />
        <DashboardStatCard label="Total books borrowed" value={data.total_books_borrowed} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection
          title="Recent loans"
          isEmpty={!data.recent_loans.length}
          emptyMessage="You have no loan history yet."
        >
          <CirculationTable>
            <CirculationTableHead columns={["Book", "Issued", "Due", "Status"]} />
            <tbody>
              {data.recent_loans.map((loan, index) => (
                <tr key={`${loan.book_title}-${loan.issued_at}-${index}`} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{loan.book_title}</td>
                  <td className="px-4 py-3">{formatDashboardDate(loan.issued_at)}</td>
                  <td className="px-4 py-3">{formatDashboardDate(loan.due_at)}</td>
                  <td className="px-4 py-3">
                    {loan.is_overdue ? "Overdue" : loan.status === "ISSUED" ? "On loan" : "Returned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </DashboardSection>

        <DashboardSection
          title="Recent reservations"
          isEmpty={!data.recent_reservations.length}
          emptyMessage="You have no active reservations."
        >
          <CirculationTable>
            <CirculationTableHead columns={["Book", "Queue", "Reserved"]} />
            <tbody>
              {data.recent_reservations.map((reservation, index) => (
                <tr
                  key={`${reservation.book_title}-${reservation.reservation_date}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{reservation.book_title}</td>
                  <td className="px-4 py-3">{reservation.queue_position ?? "—"}</td>
                  <td className="px-4 py-3">{formatDashboardDateTime(reservation.reservation_date)}</td>
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
