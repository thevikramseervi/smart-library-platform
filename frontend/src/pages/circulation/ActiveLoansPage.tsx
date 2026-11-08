import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/lib/hooks";

import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  LoanStatusBadge,
  PaginationControls,
} from "@/pages/circulation/components/CirculationShared";
import { formatDate } from "@/lib/format";
import { listTransactions } from "@/services/circulation";

export function ActiveLoansPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", "issued", page, pageSize, debouncedSearch],
    queryFn: () =>
      listTransactions({
        page,
        page_size: pageSize,
        status: "ISSUED",
        q: debouncedSearch || undefined,
      }),
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader title="Active Loans" description="All currently issued book copies." />

      <div className="space-y-2">
        <Label htmlFor="active-loan-search">Search active loans</Label>
        <Input
          id="active-loan-search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by book, student, or inventory code"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading active loans...</p>
      ) : isError ? (
        <QueryErrorState message="Unable to load active loans." onRetry={() => void refetch()} />
      ) : (
        data?.items.length ? (
        <>
          <CirculationTable
            mobileContent={data.items.map((transaction) => (
              <CirculationRecordCard
                key={transaction.id}
                title={transaction.book_copy.book.title}
                subtitle={transaction.book_copy.inventory_code}
                fields={[
                  { label: "Student", value: <>{transaction.student.first_name} {transaction.student.last_name}{transaction.student.student_code ? <span className="block text-xs text-muted-foreground">{transaction.student.student_code}</span> : null}</> },
                  { label: "Issued", value: formatDate(transaction.issued_at) },
                  { label: "Due", value: formatDate(transaction.due_at) },
                  { label: "Status", value: <LoanStatusBadge status={transaction.status} isOverdue={transaction.is_overdue} /> },
                ]}
              />
            ))}
          >
            <CirculationTableHead
              columns={["Book", "Copy", "Student", "Issued", "Due", "Status"]}
            />
            <tbody>
              {data?.items.map((transaction) => (
                <tr key={transaction.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{transaction.book_copy.book.title}</td>
                  <td className="px-4 py-3">{transaction.book_copy.inventory_code}</td>
                  <td className="px-4 py-3">
                    <p>{transaction.student.first_name} {transaction.student.last_name}</p>
                    {transaction.student.student_code ? (
                      <p className="text-xs text-muted-foreground">{transaction.student.student_code}</p>
                    ) : null}
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
        ) : (
          <EmptyState
            message={search.trim() ? "No active loans match your search." : "There are no active loans."}
            icon={BookOpen}
          />
        )
      )}
    </section>
  );
}
