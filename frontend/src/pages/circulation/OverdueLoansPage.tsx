import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { BookOpen, IndianRupee, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/lib/hooks";
import { differenceInCalendarDays, formatDate } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  PaginationControls,
  StatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import { listTransactions } from "@/services/circulation";

export function OverdueLoansPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", "overdue", page, pageSize, debouncedSearch],
    queryFn: () =>
      listTransactions({
        page,
        page_size: pageSize,
        overdue: true,
        q: debouncedSearch || undefined,
      }),
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="Overdue Loans"
        description="Issued loans past their due date."
      />

      <div className="space-y-2">
        <Label htmlFor="overdue-search">Search overdue loans</Label>
        <Input
          id="overdue-search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by book, student, or inventory code"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading overdue loans...</p>
      ) : isError ? (
        <QueryErrorState message="Unable to load overdue loans." onRetry={() => void refetch()} />
      ) : (
        data?.items.length ? (
        <>
          <CirculationTable
            mobileContent={data.items.map((transaction) => {
              const todayUtc = new Date().toISOString().slice(0, 10);
              const daysOverdue = Math.max(1, differenceInCalendarDays(transaction.due_at, todayUtc));
              return (
                <CirculationRecordCard
                  key={transaction.id}
                  title={transaction.book_copy.book.title}
                  subtitle={transaction.book_copy.inventory_code}
                  status={<StatusBadge label={`${daysOverdue} day(s) overdue`} variant="danger" />}
                  fields={[
                    { label: "Student", value: <>{transaction.student.first_name} {transaction.student.last_name}{transaction.student.student_code ? <span className="block text-xs text-muted-foreground">{transaction.student.student_code}</span> : null}</> },
                    { label: "Due", value: formatDate(transaction.due_at) },
                    { label: "Current fine", value: transaction.fine_amount ? formatInr(transaction.fine_amount) : "—" },
                  ]}
                  action={(
                    <Button asChild variant="outline" size="sm">
                      <Link to="/circulation/return" state={{ inventoryCode: transaction.book_copy.inventory_code }}>
                        <RotateCcw aria-hidden="true" /> Return
                      </Link>
                    </Button>
                  )}
                />
              );
            })}
          >
            <CirculationTableHead
              columns={["Book", "Copy", "Student", "Due", "Days overdue", "Current fine", "Action"]}
            />
            <tbody>
              {data?.items.map((transaction) => {
                const todayUtc = new Date().toISOString().slice(0, 10);
                const daysOverdue = Math.max(1, differenceInCalendarDays(transaction.due_at, todayUtc));
                return (
                  <tr key={transaction.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{transaction.book_copy.book.title}</td>
                    <td className="px-4 py-3">{transaction.book_copy.inventory_code}</td>
                    <td className="px-4 py-3">
                      <p>{transaction.student.first_name} {transaction.student.last_name}</p>
                      {transaction.student.student_code ? (
                        <p className="text-xs text-muted-foreground">{transaction.student.student_code}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{formatDate(transaction.due_at)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={`${daysOverdue} day(s) overdue`} variant="danger" />
                    </td>
                    <td className="px-4 py-3">
                      {transaction.fine_amount ? formatInr(transaction.fine_amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/circulation/return" state={{ inventoryCode: transaction.book_copy.inventory_code }}>
                          <RotateCcw aria-hidden="true" /> Return
                        </Link>
                      </Button>
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
            message={search.trim() ? "No overdue loans match your search." : "There are no overdue loans."}
            icon={search.trim() ? BookOpen : IndianRupee}
          />
        )
      )}
    </section>
  );
}
