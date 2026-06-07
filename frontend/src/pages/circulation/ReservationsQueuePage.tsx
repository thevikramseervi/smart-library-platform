import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  PaginationControls,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { formatReservationStudentLabel } from "@/pages/circulation/components/reservationQueueUtils";
import { listBooks } from "@/services/catalog/books";
import { getReservationQueue, listReservations } from "@/services/circulation";

interface SelectedBook {
  id: string;
  title: string;
}

interface ReservationsLocationState {
  bookId?: string;
  bookTitle?: string;
}

export function ReservationsQueuePage() {
  const location = useLocation();
  const locationState = (location.state as ReservationsLocationState | null) ?? null;

  const [page, setPage] = useState(1);
  const [bookSearch, setBookSearch] = useState(locationState?.bookTitle ?? "");
  const [selectedBook, setSelectedBook] = useState<SelectedBook | null>(
    locationState?.bookId && locationState?.bookTitle
      ? { id: locationState.bookId, title: locationState.bookTitle }
      : null,
  );

  const booksQuery = useQuery({
    queryKey: ["books", "reservation-filter", bookSearch],
    queryFn: () => listBooks({ search: bookSearch || undefined, page_size: 20 }),
    enabled: bookSearch.trim().length >= 2,
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", page, selectedBook?.id],
    queryFn: () =>
      listReservations({
        page,
        page_size: 20,
        book_id: selectedBook?.id,
        status: "ACTIVE",
      }),
  });

  const queueQuery = useQuery({
    queryKey: ["reservations", "queue", selectedBook?.id],
    queryFn: () => getReservationQueue(selectedBook!.id),
    enabled: Boolean(selectedBook),
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
        {booksQuery.data?.items.length ? (
          <div className="max-h-40 overflow-y-auto rounded-md border">
            {booksQuery.data.items.map((book) => (
              <button
                key={book.id}
                type="button"
                className={[
                  "block w-full px-3 py-2 text-left text-sm hover:bg-muted",
                  selectedBook?.id === book.id ? "bg-muted font-medium" : "",
                ].join(" ")}
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
        {selectedBook ? (
          <p className="text-sm text-muted-foreground">Selected: {selectedBook.title}</p>
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

      {selectedBook && queueQuery.data ? (
        <>
          <h3 className="text-lg font-medium">Queue for {selectedBook.title}</h3>
          {queueQuery.data.length ? (
            <CirculationTable>
              <CirculationTableHead columns={["Position", "Student", "Reserved", "Expires", "Status"]} />
              <tbody>
                {queueQuery.data.map((reservation) => (
                  <tr key={reservation.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{reservation.queue_position ?? "—"}</td>
                    <td className="px-4 py-3">{formatReservationStudentLabel(reservation)}</td>
                    <td className="px-4 py-3">{formatDate(reservation.reservation_date)}</td>
                    <td className="px-4 py-3">{formatDate(reservation.expiry_date)}</td>
                    <td className="px-4 py-3">{reservation.status}</td>
                  </tr>
                ))}
              </tbody>
            </CirculationTable>
          ) : (
            <p className="text-sm text-muted-foreground">No active reservations in this queue.</p>
          )}
        </>
      ) : null}

      {reservationsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reservations...</p>
      ) : (
        <>
          <CirculationTable>
            <CirculationTableHead
              columns={["Book", "Student", "Position", "Reserved", "Expires", "Status"]}
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
                  <td className="px-4 py-3">{reservation.status}</td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
          {reservationsQuery.data ? (
            <PaginationControls
              page={reservationsQuery.data.page}
              totalPages={reservationsQuery.data.total_pages}
              total={reservationsQuery.data.total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
