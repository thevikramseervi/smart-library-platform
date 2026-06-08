import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  LoanStatusBadge,
  PaginationControls,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { listTransactions } from "@/services/circulation";

export function ActiveLoansPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["transactions", "issued", page, pageSize],
    queryFn: () => listTransactions({ page, page_size: pageSize, status: "ISSUED" }),
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader title="Active Loans" description="All currently issued book copies." />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading active loans...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load active loans.</p>
      ) : (
        <>
          <CirculationTable>
            <CirculationTableHead
              columns={["Book", "Copy", "Student", "Issued", "Due", "Status"]}
            />
            <tbody>
              {data?.items.map((transaction) => (
                <tr key={transaction.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{transaction.book_copy.book.title}</td>
                  <td className="px-4 py-3">{transaction.book_copy.inventory_code}</td>
                  <td className="px-4 py-3">
                    {transaction.student.first_name} {transaction.student.last_name}
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
          {data ? (
            <PaginationControls
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
