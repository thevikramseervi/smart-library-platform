import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  LoanStatusBadge,
  PaginationControls,
} from "@/pages/circulation/components/CirculationShared";
import { appToast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { differenceInCalendarDays, formatDate, getDueDateLabel } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import { listMyActiveTransactions, listMyTransactions, renewLoan } from "@/services/circulation";
import type { StudentActiveTransaction } from "@/types/circulation";

export function MyLoansPage() {
  const queryClient = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [renewTarget, setRenewTarget] = useState<StudentActiveTransaction | null>(null);
  const todayUtc = new Date().toISOString().slice(0, 10);
  const activeQuery = useQuery({
    queryKey: ["transactions", "me", "active"],
    queryFn: listMyActiveTransactions,
  });

  const historyQuery = useQuery({
    queryKey: ["transactions", "me", "history", historyPage, historyPageSize],
    queryFn: () =>
      listMyTransactions({
        page: historyPage,
        page_size: historyPageSize,
        status: "RETURNED",
      }),
  });

  const renewalMutation = useMutation({
    mutationFn: (transactionId: string) => renewLoan(transactionId),
    onSuccess: (transaction) => {
      appToast.success(`Book renewed. New due date: ${formatDate(transaction.due_at)}.`);
      setRenewTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions", "me", "active"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["fines", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "student"] });
    },
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
          <QueryErrorState
            message="Unable to load active loans."
            onRetry={() => void activeQuery.refetch()}
          />
        ) : activeQuery.data?.length ? (
          <CirculationTable
            ariaLabel="Active loans"
            mobileContent={activeQuery.data.map((transaction) => (
              <CirculationRecordCard
                key={transaction.id}
                title={(
                  <Link to={`/catalog/books/${transaction.book_copy.book.id}`} className="hover:underline">
                    {transaction.book_copy.book.title}
                  </Link>
                )}
                fields={[
                  { label: "Issued", value: formatDate(transaction.issued_at) },
                  { label: "Due", value: <>{formatDate(transaction.due_at)}<span className="mt-1 block text-xs text-muted-foreground">{getDueDateLabel(transaction.due_at, todayUtc)}</span></> },
                  { label: "Renewals", value: `${transaction.renewal_count} of ${transaction.max_renewals} used` },
                  { label: "Status", value: <LoanStatusBadge status={transaction.status} isOverdue={transaction.is_overdue} /> },
                  { label: "Fine balance", value: transaction.fine_amount && Number(transaction.fine_amount) > 0 ? <><Link to="/circulation/my-fines" className="font-medium text-destructive hover:underline">{formatInr(transaction.fine_amount)}</Link><span className="mt-1 block text-xs text-muted-foreground">{transaction.fine_is_capped ? "Maximum reached" : "Accruing until returned"}</span></> : "—", wide: true },
                ]}
                action={(
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      transaction.is_overdue ||
                      transaction.renewal_count >= transaction.max_renewals ||
                      renewalMutation.isPending
                    }
                    onClick={() => {
                      renewalMutation.reset();
                      setRenewTarget(transaction);
                    }}
                  >
                    {transaction.renewal_count >= transaction.max_renewals
                      ? "Renewal limit reached"
                      : transaction.is_overdue
                        ? "Overdue loan"
                        : "Renew book"}
                  </Button>
                )}
              />
            ))}
          >
            <CirculationTableHead columns={["Book", "Issued", "Due", "Fine balance", "Renewals", "Action"]} />
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
                  <td className="px-4 py-3">
                    <p>{formatDate(transaction.due_at)}</p>
                    <p
                      className={[
                        "mt-1 text-xs font-medium",
                        transaction.is_overdue
                          ? "text-destructive"
                          : differenceInCalendarDays(todayUtc, transaction.due_at) <= 3
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {getDueDateLabel(transaction.due_at, todayUtc)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {transaction.fine_amount && Number(transaction.fine_amount) > 0 ? (
                      <div>
                        <Link
                          to="/circulation/my-fines"
                          className="text-sm font-medium text-destructive hover:underline"
                        >
                          {formatInr(transaction.fine_amount)}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {transaction.fine_is_capped
                            ? "Maximum reached"
                            : "Accruing until returned"}
                        </p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {transaction.renewal_count} of {transaction.max_renewals} used
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        transaction.is_overdue ||
                        transaction.renewal_count >= transaction.max_renewals ||
                        renewalMutation.isPending
                      }
                      onClick={() => {
                        renewalMutation.reset();
                        setRenewTarget(transaction);
                      }}
                    >
                      {transaction.renewal_count >= transaction.max_renewals
                        ? "Limit reached"
                        : transaction.is_overdue
                          ? "Overdue"
                          : "Renew"}
                    </Button>
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
          <QueryErrorState
            message="Unable to load borrowing history."
            onRetry={() => void historyQuery.refetch()}
          />
        ) : historyQuery.data?.items.length ? (
          <div className="space-y-4">
          <CirculationTable
            mobileContent={historyQuery.data.items.map((transaction) => (
              <CirculationRecordCard
                key={transaction.id}
                title={(
                  <Link to={`/catalog/books/${transaction.book_copy.book.id}`} className="hover:underline">
                    {transaction.book_copy.book.title}
                  </Link>
                )}
                fields={[
                  { label: "Issued", value: formatDate(transaction.issued_at) },
                  { label: "Returned", value: transaction.returned_at ? formatDate(transaction.returned_at) : "—" },
                  { label: "Status", value: <LoanStatusBadge status={transaction.status} isOverdue={transaction.is_overdue} />, wide: true },
                ]}
              />
            ))}
          >
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
          {historyQuery.data ? (
            <PaginationControls
              page={historyQuery.data.page}
              totalPages={historyQuery.data.total_pages}
              total={historyQuery.data.total}
              pageSize={historyPageSize}
              onPageChange={setHistoryPage}
              onPageSizeChange={(size) => {
                setHistoryPageSize(size);
                setHistoryPage(1);
              }}
            />
          ) : null}
          </div>
        ) : (
          <EmptyState
            message="No returned books in your history yet."
            icon={BookOpen}
            actionLabel="Browse Catalog"
            actionTo="/catalog/books"
          />
        )}
      </div>

      <ConfirmDialog
        open={renewTarget !== null}
        onOpenChange={(open) => {
          if (!open && !renewalMutation.isPending) {
            setRenewTarget(null);
            renewalMutation.reset();
          }
        }}
        title="Renew this book?"
        description={
          renewTarget
            ? `This will extend “${renewTarget.book_copy.book.title}” from its current due date by one standard loan period. Renewals are unavailable when the loan is overdue, someone is waiting for the book, or you have an unpaid fine.`
            : "Confirm the loan renewal."
        }
        confirmLabel="Confirm renewal"
        pending={renewalMutation.isPending}
        errorMessage={
          renewalMutation.isError
            ? getApiErrorMessage(renewalMutation.error, "Could not renew this book.")
            : null
        }
        onConfirm={() => {
          if (renewTarget) renewalMutation.mutate(renewTarget.id);
        }}
      />
    </section>
  );
}
