import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import { ReturnReservationNoticeActions } from "@/pages/circulation/components/ReservationQueueWarning";
import { CirculationPageHeader } from "@/pages/circulation/components/CirculationShared";
import { getReservationQueue, listTransactions, returnBook } from "@/services/circulation";
import type { Reservation, Transaction } from "@/types/circulation";

interface ReturnQueueNotice {
  bookId: string;
  bookTitle: string;
  copyId: string;
  queue: Reservation[];
}

export function ReturnBookPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingReturn, setPendingReturn] = useState<Transaction | null>(null);
  const [queueNotice, setQueueNotice] = useState<ReturnQueueNotice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeLoansQuery = useQuery({
    queryKey: ["transactions", "issued"],
    queryFn: () => listTransactions({ status: "ISSUED", page: 1, page_size: 100 }),
  });

  const filteredLoans = useMemo(() => {
    const loans = activeLoansQuery.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return loans;
    }
    return loans.filter((transaction) => {
      const haystack = [
        transaction.book_copy.book.title,
        transaction.book_copy.inventory_code,
        transaction.student.first_name,
        transaction.student.last_name,
        transaction.student.student_code ?? "",
        transaction.student.email,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [activeLoansQuery.data?.items, search]);

  const returnMutation = useMutation({
    mutationFn: (bookCopyId: string) => returnBook({ book_copy_id: bookCopyId }),
    onSuccess: async (transaction) => {
      appToast.returned(`Returned ${transaction.book_copy.book.title}`);
      setErrorMessage(null);
      setPendingReturn(null);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["circulation", "copies"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });

      const bookId = transaction.book_copy.book_id;
      const queue = await getReservationQueue(bookId);
      if (queue.length) {
        setQueueNotice({
          bookId,
          bookTitle: transaction.book_copy.book.title,
          copyId: transaction.book_copy_id,
          queue,
        });
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
        <Input
          id="return-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by book title, student name, or inventory code"
        />
        <p className="text-xs text-muted-foreground">
          {activeLoansQuery.isLoading
            ? "Loading active loans..."
            : `Showing ${filteredLoans.length} of ${activeLoansQuery.data?.items.length ?? 0} active loans.`}
        </p>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {activeLoansQuery.isError ? (
        <p className="text-sm text-destructive">Unable to load active loans.</p>
      ) : filteredLoans.length ? (
        <div className="space-y-3">
          {filteredLoans.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{transaction.book_copy.book.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.book_copy.inventory_code} · {transaction.student.first_name}{" "}
                    {transaction.student.last_name}
                    {transaction.student.student_code
                      ? ` (${transaction.student.student_code})`
                      : ""}{" "}
                    · Due {transaction.due_at}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setPendingReturn(transaction)}>
                  Return
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {search.trim() ? "No active loans match your search." : "No active loans to return."}
        </p>
      )}

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
              This will mark the copy as returned and make it available for circulation again unless
              it is overdue.
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
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingReturn(null)}>
              Cancel
            </Button>
            <Button
              disabled={!pendingReturn || returnMutation.isPending}
              onClick={() => {
                if (pendingReturn) {
                  returnMutation.mutate(pendingReturn.book_copy_id);
                }
              }}
            >
              {returnMutation.isPending ? "Returning..." : "Confirm Return"}
            </Button>
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
