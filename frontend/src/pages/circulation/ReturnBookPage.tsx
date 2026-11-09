import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import { QrCodeScanner } from "@/components/circulation/QrCodeScanner";
import { appToast } from "@/lib/toast";
import { formatInr } from "@/lib/formatCurrency";
import { ReturnReservationNoticeActions } from "@/pages/circulation/components/ReservationQueueWarning";
import {
  CirculationRecordCard,
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  PaginationControls,
} from "@/pages/circulation/components/CirculationShared";
import { getReservationQueue, listTransactions, returnBook } from "@/services/circulation";
import type { Reservation, Transaction } from "@/types/circulation";

interface ReturnQueueNotice {
  bookId: string;
  bookTitle: string;
  copyId: string;
  queue: Reservation[];
}

export function ReturnBookPage() {
  const location = useLocation();
  const locationState = location.state as { inventoryCode?: string } | null;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(locationState?.inventoryCode ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebouncedValue(search.trim());
  const [pendingReturn, setPendingReturn] = useState<Transaction | null>(null);
  const [queueNotice, setQueueNotice] = useState<ReturnQueueNotice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueLookupWarning, setQueueLookupWarning] = useState<string | null>(null);
  const handleQrScan = useCallback((code: string) => {
    setSearch(code);
    setPage(1);
  }, []);

  const activeLoansQuery = useQuery({
    queryKey: ["transactions", "issued", "return", page, pageSize, debouncedSearch],
    queryFn: () =>
      listTransactions({
        status: "ISSUED",
        page,
        page_size: pageSize,
        q: debouncedSearch || undefined,
      }),
  });

  const isSearching =
    debouncedSearch !== search.trim() || activeLoansQuery.isFetching;
  const loans = activeLoansQuery.data?.items ?? [];

  const returnMutation = useMutation({
    mutationFn: ({ bookCopyId, payFine }: { bookCopyId: string; payFine: boolean }) =>
      returnBook({ book_copy_id: bookCopyId, ...(payFine ? { pay_fine: true } : {}) }),
    onMutate: () => {
      setErrorMessage(null);
      setQueueLookupWarning(null);
    },
    onSuccess: async (transaction, variables) => {
      const fineText = transaction.fine_amount && Number(transaction.fine_amount) > 0
        ? ` Fine: ${formatInr(transaction.fine_amount)}${variables.payFine ? " (payment recorded)." : ""}`
        : "";
      appToast.returned(`Returned ${transaction.book_copy.book.title}.${fineText}`);
      setErrorMessage(null);
      setPendingReturn(null);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["circulation", "copies"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      const bookId = transaction.book_copy.book_id;
      try {
        const queue = await getReservationQueue(bookId);
        if (queue.length) {
          setQueueNotice({
            bookId,
            bookTitle: transaction.book_copy.book.title,
            copyId: transaction.book_copy_id,
            queue,
          });
        }
      } catch {
        setQueueLookupWarning(
          "The book was returned, but its reservation queue could not be checked. Review the queue before issuing this copy again.",
        );
      }
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to return book."));
    },
  });

  const studentName = pendingReturn
    ? `${pendingReturn.student.first_name} ${pendingReturn.student.last_name}`
    : "";

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="Return Book"
        description="Return a borrowed copy from the active loans list."
      />

      <div className="space-y-2">
        <Label htmlFor="return-search">Filter active loans</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="return-search"
            className="min-w-0 flex-1"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by book title, student name, or inventory code"
          />
          <QrCodeScanner onScan={handleQrScan} />
        </div>
        <p className="text-xs text-muted-foreground">
          Search by book title, student name, or inventory code.
        </p>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {queueLookupWarning ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {queueLookupWarning}
        </p>
      ) : null}

      {activeLoansQuery.isError ? (
        <QueryErrorState
          message="Unable to load active loans."
          onRetry={() => void activeLoansQuery.refetch()}
        />
      ) : isSearching ? (
        <p role="status" className="text-sm text-muted-foreground">
          Searching active loans...
        </p>
      ) : loans.length ? (
        <CirculationTable
          ariaLabel="Returnable active loans"
          mobileContent={loans.map((transaction) => (
            <CirculationRecordCard
              key={transaction.id}
              title={transaction.book_copy.book.title}
              subtitle={transaction.book_copy.inventory_code}
              fields={[
                {
                  label: "Student",
                  value: (
                    <>
                      {transaction.student.first_name} {transaction.student.last_name}
                      {transaction.student.student_code ? (
                        <span className="block text-xs text-muted-foreground">
                          {transaction.student.student_code}
                        </span>
                      ) : null}
                    </>
                  ),
                  wide: true,
                },
                { label: "Due", value: formatDate(transaction.due_at) },
                {
                  label: "Unpaid fine",
                  value:
                    transaction.is_overdue && transaction.fine_amount
                      ? (
                          <span className="font-medium text-destructive">
                            {formatInr(transaction.fine_amount)}
                          </span>
                        )
                      : "—",
                },
              ]}
              action={
                <Button variant="outline" size="sm" onClick={() => setPendingReturn(transaction)}>
                  Return
                </Button>
              }
            />
          ))}
        >
          <CirculationTableHead
            columns={["Book", "Copy", "Student", "Due", "Unpaid fine", "Action"]}
          />
          <tbody>
            {loans.map((transaction) => (
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
                  {transaction.is_overdue && transaction.fine_amount ? (
                    <span className="font-medium text-destructive">
                      {formatInr(transaction.fine_amount)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => setPendingReturn(transaction)}>
                    Return
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </CirculationTable>
      ) : (
        <p className="text-sm text-muted-foreground">
          {search.trim() ? "No active loans match your search." : "No active loans to return."}
        </p>
      )}

      {activeLoansQuery.data ? (
        <PaginationControls
          page={activeLoansQuery.data.page}
          totalPages={activeLoansQuery.data.total_pages}
          total={activeLoansQuery.data.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      ) : null}

      <Dialog
        open={pendingReturn !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReturn(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm return</DialogTitle>
            <DialogDescription>
              This will mark the copy as returned. If the book has an active reservation queue, the
              copy is held as RESERVED for the first student in line; otherwise it becomes available
              for circulation again.
            </DialogDescription>
          </DialogHeader>
          {pendingReturn ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Book</dt>
                <dd className="mt-1">{pendingReturn.book_copy.book.title}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Student</dt>
                <dd className="mt-1">{studentName}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Inventory code</dt>
                <dd className="mt-1">{pendingReturn.book_copy.inventory_code}</dd>
              </div>
              {pendingReturn.is_overdue && pendingReturn.fine_amount ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <dt className="font-medium text-destructive">Unpaid overdue fine</dt>
                  <dd className="mt-1 font-semibold">{formatInr(pendingReturn.fine_amount)}</dd>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This is the current accrued amount. Returning finalizes it. You can record
                    payment now or leave it unpaid.
                  </p>
                </div>
              ) : null}
            </dl>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button className="w-full" variant="outline" onClick={() => setPendingReturn(null)}>
              Cancel
            </Button>
            {pendingReturn?.is_overdue && pendingReturn.fine_amount ? (
              <>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={returnMutation.isPending}
                  onClick={() => {
                    if (pendingReturn) {
                      returnMutation.mutate({
                        bookCopyId: pendingReturn.book_copy_id,
                        payFine: false,
                      });
                    }
                  }}
                >
                  Return without payment
                </Button>
                <Button
                  className="w-full"
                  disabled={returnMutation.isPending}
                  onClick={() => {
                    if (pendingReturn) {
                      returnMutation.mutate({
                        bookCopyId: pendingReturn.book_copy_id,
                        payFine: true,
                      });
                    }
                  }}
                >
                  {returnMutation.isPending ? "Returning..." : "Return & record payment"}
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                disabled={!pendingReturn || returnMutation.isPending}
                onClick={() => {
                  if (pendingReturn) {
                    returnMutation.mutate({ bookCopyId: pendingReturn.book_copy_id, payFine: false });
                  }
                }}
              >
                {returnMutation.isPending ? "Returning..." : "Confirm Return"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={queueNotice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setQueueNotice(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Return complete</DialogTitle>
            <DialogDescription>
              Review the reservation queue before issuing this copy to another student.
            </DialogDescription>
          </DialogHeader>
          {queueNotice ? (
            <ReturnReservationNoticeActions
              queue={queueNotice.queue}
              bookTitle={queueNotice.bookTitle}
              bookId={queueNotice.bookId}
              copyId={queueNotice.copyId}
              onClose={() => setQueueNotice(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
