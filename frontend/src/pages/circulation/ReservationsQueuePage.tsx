import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  PaginationControls,
  ReservationStatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import { formatDate } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import { formatReservationStudentLabel } from "@/pages/circulation/components/reservationQueueUtils";
import { listBooks } from "@/services/catalog/books";
import { cancelReservation, getReservationQueue, listReservations } from "@/services/circulation";
import type { Reservation } from "@/types/circulation";

interface SelectedBook {
  id: string;
  title: string;
}

interface ReservationsLocationState {
  bookId?: string;
  bookTitle?: string;
}

export function ReservationsQueuePage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = (location.state as ReservationsLocationState | null) ?? null;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [bookSearch, setBookSearch] = useState(locationState?.bookTitle ?? "");
  const [selectedBook, setSelectedBook] = useState<SelectedBook | null>(
    locationState?.bookId && locationState?.bookTitle
      ? { id: locationState.bookId, title: locationState.bookTitle }
      : null,
  );
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const booksQuery = useQuery({
    queryKey: ["books", "reservation-filter", bookSearch],
    queryFn: () => listBooks({ search: bookSearch || undefined, page_size: 20 }),
    enabled: !selectedBook && bookSearch.trim().length >= 2,
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", page, pageSize],
    queryFn: () =>
      listReservations({
        page,
        page_size: pageSize,
        status: "ACTIVE",
      }),
  });

  const queueQuery = useQuery({
    queryKey: ["reservations", "queue", selectedBook?.id],
    queryFn: () => getReservationQueue(selectedBook!.id),
    enabled: Boolean(selectedBook),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      appToast.cancelled("Reservation cancelled");
      setReservationToCancel(null);
      setCancelError(null);
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error) => {
      setCancelError(getApiErrorMessage(error, "Unable to cancel reservation."));
    },
  });

  const booksWithReservations = useMemo(() => {
    const titles = new Map<string, string>();
    for (const reservation of reservationsQuery.data?.items ?? []) {
      titles.set(reservation.book_id, reservation.book.title);
    }
    return titles;
  }, [reservationsQuery.data?.items]);

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="Reservations"
        description="View active reservation queues by book title."
      />

      {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}

      <div className="space-y-2">
        <Label htmlFor="book-search">Find book</Label>
        <Input
          id="book-search"
          value={bookSearch}
          onChange={(event) => {
            setBookSearch(event.target.value);
            setSelectedBook(null);
          }}
          placeholder="Type at least 2 characters to search by title"
        />
        {bookSearch.trim().length > 0 && bookSearch.trim().length < 2 ? (
          <p className="text-xs text-muted-foreground">Enter at least 2 characters to search.</p>
        ) : null}
        {booksQuery.isLoading && !selectedBook ? (
          <p className="text-sm text-muted-foreground">Searching books...</p>
        ) : null}
        {booksQuery.isError && !selectedBook ? (
          <QueryErrorState
            message="Unable to search books."
            onRetry={() => void booksQuery.refetch()}
          />
        ) : null}
        {!selectedBook && booksQuery.data?.items.length ? (
          <div className="max-h-40 overflow-y-auto rounded-md border">
            {booksQuery.data.items.map((book) => (
              <button
                key={book.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setSelectedBook({ id: book.id, title: book.title });
                  setBookSearch(book.title);
                }}
              >
                {book.title}
                {book.authors?.length ? ` · ${book.authors.map((author) => author.name).join(", ")}` : ""}
              </button>
            ))}
          </div>
        ) : null}
        {!selectedBook && bookSearch.trim().length >= 2 && !booksQuery.isLoading &&
        !booksQuery.isError && !booksQuery.data?.items.length ? (
          <p className="text-sm text-muted-foreground">No books match that title.</p>
        ) : null}
        {selectedBook ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Selected: {selectedBook.title}</p>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setSelectedBook(null);
                setBookSearch("");
              }}
            >
              Clear selection
            </button>
          </div>
        ) : booksWithReservations.size > 0 ? (
          <div className="flex flex-wrap gap-2">
            {[...booksWithReservations.entries()].map(([bookId, title]) => (
              <button
                key={bookId}
                type="button"
                className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                onClick={() => setSelectedBook({ id: bookId, title })}
              >
                {title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {selectedBook ? (
        <>
          <h3 className="text-lg font-medium">Queue for {selectedBook.title}</h3>
          {queueQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading reservation queue...</p>
          ) : queueQuery.isError ? (
            <QueryErrorState
              message="Unable to load this reservation queue."
              onRetry={() => void queueQuery.refetch()}
            />
          ) : queueQuery.data?.length ? (
            <CirculationTable
              mobileContent={queueQuery.data.map((reservation) => (
                <CirculationRecordCard
                  key={reservation.id}
                  title={formatReservationStudentLabel(reservation)}
                  status={<ReservationStatusBadge status={reservation.status} />}
                  fields={[
                    { label: "Queue position", value: reservation.queue_position ?? "—" },
                    { label: "Reserved", value: formatDate(reservation.reservation_date) },
                    { label: "Expires", value: formatDate(reservation.expiry_date) },
                  ]}
                  action={(
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => setReservationToCancel(reservation)}
                    >
                      Cancel reservation
                    </Button>
                  )}
                />
              ))}
            >
              <CirculationTableHead columns={["Position", "Student", "Reserved", "Expires", "Status", "Action"]} />
              <tbody>
                {queueQuery.data.map((reservation) => (
                  <tr key={reservation.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{reservation.queue_position ?? "—"}</td>
                    <td className="px-4 py-3">{formatReservationStudentLabel(reservation)}</td>
                    <td className="px-4 py-3">{formatDate(reservation.reservation_date)}</td>
                    <td className="px-4 py-3">{formatDate(reservation.expiry_date)}</td>
                    <td className="px-4 py-3">
                      <ReservationStatusBadge status={reservation.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancelMutation.isPending}
                        onClick={() => setReservationToCancel(reservation)}
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </CirculationTable>
          ) : (
            <EmptyState
              message="No active reservations in this queue."
              icon={BookMarked}
            />
          )}
        </>
      ) : null}

      {!selectedBook && reservationsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reservations...</p>
      ) : null}
      {!selectedBook && reservationsQuery.isError ? (
        <QueryErrorState
          message="Unable to load reservations."
          onRetry={() => void reservationsQuery.refetch()}
        />
      ) : null}
      {!selectedBook && !reservationsQuery.isLoading && !reservationsQuery.isError && reservationsQuery.data?.items.length ? (
        <>
          <CirculationTable
            mobileContent={reservationsQuery.data.items.map((reservation) => (
              <CirculationRecordCard
                key={reservation.id}
                title={(
                  <button
                    type="button"
                    className="text-left font-semibold hover:underline"
                    onClick={() => setSelectedBook({ id: reservation.book_id, title: reservation.book.title })}
                  >
                    {reservation.book.title}
                  </button>
                )}
                status={<ReservationStatusBadge status={reservation.status} />}
                fields={[
                  { label: "Student", value: formatReservationStudentLabel(reservation) },
                  { label: "Queue position", value: reservation.queue_position ?? "—" },
                  { label: "Reserved", value: formatDate(reservation.reservation_date) },
                  { label: "Expires", value: formatDate(reservation.expiry_date) },
                ]}
                action={(
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelMutation.isPending}
                    onClick={() => setReservationToCancel(reservation)}
                  >
                    Cancel reservation
                  </Button>
                )}
              />
            ))}
          >
            <CirculationTableHead
              columns={["Book", "Student", "Position", "Reserved", "Expires", "Status", "Action"]}
            />
            <tbody>
              {reservationsQuery.data?.items.map((reservation) => (
                <tr key={reservation.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() =>
                        setSelectedBook({
                          id: reservation.book_id,
                          title: reservation.book.title,
                        })
                      }
                    >
                      {reservation.book.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">{formatReservationStudentLabel(reservation)}</td>
                  <td className="px-4 py-3">{reservation.queue_position ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(reservation.reservation_date)}</td>
                  <td className="px-4 py-3">{formatDate(reservation.expiry_date)}</td>
                  <td className="px-4 py-3">
                    <ReservationStatusBadge status={reservation.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => setReservationToCancel(reservation)}
                    >
                      Cancel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
          {reservationsQuery.data ? (
            <PaginationControls
              page={reservationsQuery.data.page}
              totalPages={reservationsQuery.data.total_pages}
              total={reservationsQuery.data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </>
      ) : null}
      {!selectedBook &&
      !reservationsQuery.isLoading &&
      !reservationsQuery.isError &&
      !reservationsQuery.data?.items.length ? (
        <EmptyState message="There are no active reservations." icon={BookMarked} />
      ) : null}
      <ConfirmDialog
        open={reservationToCancel !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) setReservationToCancel(null);
        }}
        title="Cancel this reservation?"
        description={
          reservationToCancel
            ? `Cancel ${reservationToCancel.student.first_name} ${reservationToCancel.student.last_name}'s reservation for ${reservationToCancel.book.title}? The remaining queue positions will update.`
            : "This will remove the active reservation from the queue."
        }
        confirmLabel="Cancel reservation"
        destructive
        pending={cancelMutation.isPending}
        onConfirm={() => {
          if (reservationToCancel) cancelMutation.mutate(reservationToCancel.id);
        }}
      />
    </section>
  );
}
