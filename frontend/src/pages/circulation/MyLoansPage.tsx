import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";
import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  LoanStatusBadge,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { listMyActiveTransactions, listMyTransactions } from "@/services/circulation";

export function MyLoansPage() {
  const activeQuery = useQuery({
    queryKey: ["transactions", "me", "active"],
    queryFn: listMyActiveTransactions,
  });

  const historyQuery = useQuery({
    queryKey: ["transactions", "me", "history"],
    queryFn: () => listMyTransactions({ page: 1, page_size: 20 }),
  });

  return (
    <section className="space-y-8">
      <CirculationPageHeader
        title="My Loans"
        description="Your active loans and recent borrowing history."
      />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Active loans</h3>
        {activeQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading active loans...</p>
        ) : activeQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load active loans.</p>
        ) : activeQuery.data?.length ? (
          <CirculationTable>
            <CirculationTableHead columns={["Book", "Issued", "Due", "Status"]} />
            <tbody>
              {activeQuery.data.map((transaction) => (
                <tr key={transaction.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/catalog/books/${transaction.book_copy.book.id}`}
                      className="font-medium hover:underline"
                    >
                      {transaction.book_copy.book.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(transaction.issued_at)}</td>
                  <td className="px-4 py-3">{formatDate(transaction.due_at)}</td>
                  <td className="px-4 py-3">
                    <LoanStatusBadge
                      status={transaction.status}
                      isOverdue={transaction.is_overdue}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        ) : (
          <EmptyState
            message="You're all caught up — no active loans."
            icon={BookOpen}
            actionLabel="Browse Catalog"
            actionTo="/catalog/books"
          />
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">History</h3>
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history...</p>
        ) : historyQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load borrowing history.</p>
        ) : historyQuery.data?.items.length ? (
          <CirculationTable>
            <CirculationTableHead columns={["Book", "Issued", "Returned", "Status"]} />
            <tbody>
              {historyQuery.data.items.map((transaction) => (
                <tr key={transaction.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/catalog/books/${transaction.book_copy.book.id}`}
                      className="font-medium hover:underline"
                    >
                      {transaction.book_copy.book.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(transaction.issued_at)}</td>
                  <td className="px-4 py-3">
                    {transaction.returned_at ? formatDate(transaction.returned_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <LoanStatusBadge
                      status={transaction.status}
                      isOverdue={transaction.is_overdue}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        ) : (
          <EmptyState
            message="No borrowing history yet."
            icon={BookOpen}
            actionLabel="Browse Catalog"
            actionTo="/catalog/books"
          />
        )}
      </div>
    </section>
  );
}
