import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  PaginationControls,
  StatusBadge,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { listTransactions } from "@/services/circulation";

export function OverdueLoansPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["transactions", "overdue", page],
    queryFn: () => listTransactions({ page, page_size: 20, overdue: true }),
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="Overdue Loans"
        description="Issued loans past their due date."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading overdue loans...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load overdue loans.</p>
      ) : (
        <>
          <CirculationTable>
            <CirculationTableHead
              columns={["Book", "Copy", "Student", "Due", "Days overdue"]}
            />
            <tbody>
              {data?.items.map((transaction) => {
                const due = new Date(transaction.due_at);
                const today = new Date();
                const daysOverdue = Math.max(
                  0,
                  Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)),
                );
                return (
                  <tr key={transaction.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{transaction.book_copy.book.title}</td>
                    <td className="px-4 py-3">{transaction.book_copy.inventory_code}</td>
                    <td className="px-4 py-3">
                      {transaction.student.first_name} {transaction.student.last_name}
                    </td>
                    <td className="px-4 py-3">{formatDate(transaction.due_at)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={`${daysOverdue} day(s)`} variant="warning" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </CirculationTable>
          {data ? (
            <PaginationControls
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
