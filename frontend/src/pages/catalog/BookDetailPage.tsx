import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useIsStaff } from "@/components/auth/StaffRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/apiError";
import { createBookCopy, getBook, listBookCopies, updateBookCopy } from "@/services/catalog";
import type { BookCopy, BookCopyStatus } from "@/types/catalog";
import { STAFF_MANAGEABLE_COPY_STATUSES } from "@/types/catalog";
import { createReservation, listMyReservations } from "@/services/circulation";
import type { Book } from "@/types/catalog";
import type { Reservation } from "@/types/circulation";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
} from "@/pages/catalog/components/CatalogShared";
import { appToast } from "@/lib/toast";
import {
  BookCopyStatusBadge,
  StatusBadge,
} from "@/pages/circulation/components/CirculationShared";

interface BookAvailability {
  status: string;
  statusVariant: "default" | "warning" | "success";
  reservationEligibility: string;
  canReserve: boolean;
}

function getBookAvailability(
  book: Book,
  activeReservation?: Reservation,
): BookAvailability {
  if (book.total_copies === 0) {
    return {
      status: "Not in collection",
      statusVariant: "default",
      reservationEligibility: "This book has no physical copies in the library.",
      canReserve: false,
    };
  }

  if (book.available_copies > 0) {
    return {
      status: "Available",
      statusVariant: "success",
      reservationEligibility:
        "Copies are available to borrow. Visit the circulation desk — no reservation needed.",
      canReserve: false,
    };
  }

  if (activeReservation) {
    return {
      status: "Unavailable",
      statusVariant: "warning",
      reservationEligibility: `You already have an active reservation${
        activeReservation.queue_position ? ` (queue position #${activeReservation.queue_position})` : ""
      }.`,
      canReserve: false,
    };
  }

  return {
    status: "Unavailable",
    statusVariant: "warning",
    reservationEligibility:
      "All copies are currently checked out. You can join the reservation queue for this book.",
    canReserve: true,
  };
}

function CopyStatusCell({
  copy,
  bookId,
  onError,
}: {
  copy: BookCopy;
  bookId: string;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: (status: BookCopyStatus) => updateBookCopy(copy.id, { status }),
    onSuccess: () => {
      appToast.updated("Copy status");
      onError("");
      queryClient.invalidateQueries({ queryKey: ["book-copies", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => {
      onError(getApiErrorMessage(error, "Unable to update copy status."));
    },
  });

  if (copy.status === "BORROWED" || copy.status === "RESERVED") {
    return <BookCopyStatusBadge status={copy.status} />;
  }

  return (
    <select
      className="rounded-md border bg-background px-2 py-1 text-sm"
      value={copy.status}
      disabled={updateStatusMutation.isPending}
      onChange={(event) => updateStatusMutation.mutate(event.target.value as BookCopyStatus)}
    >
      {STAFF_MANAGEABLE_COPY_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();
  const [inventoryCode, setInventoryCode] = useState("");
  const [location, setLocation] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);

  const bookQuery = useQuery({
    queryKey: ["books", id],
    queryFn: () => getBook(id!),
    enabled: Boolean(id),
  });

  const copiesQuery = useQuery({
    queryKey: ["book-copies", id],
    queryFn: () => listBookCopies({ book_id: id }),
    enabled: Boolean(id) && isStaff,
  });

  const myReservationsQuery = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: listMyReservations,
    enabled: Boolean(id) && !isStaff,
  });

  const activeReservation = myReservationsQuery.isSuccess
    ? myReservationsQuery.data?.find(
        (reservation) => reservation.book_id === id && reservation.status === "ACTIVE",
      )
    : undefined;

  const reserveMutation = useMutation({
    mutationFn: () => createReservation({ book_id: id! }),
    onSuccess: (reservation) => {
      appToast.reserved(
        `You are #${reservation.queue_position ?? "—"} in the queue`,
      );
      setReservationError(null);
      queryClient.invalidateQueries({ queryKey: ["reservations", "me"] });
    },
    onError: (error) => {
      setReservationError(getApiErrorMessage(error, "Unable to create reservation."));
    },
  });

  const createCopyMutation = useMutation({
    mutationFn: () =>
      createBookCopy({
        book_id: id!,
        inventory_code: inventoryCode.trim() || undefined,
        location: location || null,
      }),
    onSuccess: () => {
      appToast.created("Book copy");
      setInventoryCode("");
      setLocation("");
      setCopyError(null);
      queryClient.invalidateQueries({ queryKey: ["book-copies", id] });
      queryClient.invalidateQueries({ queryKey: ["books", id] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => {
      setCopyError(getApiErrorMessage(error, "Unable to add copy."));
    },
  });

  if (bookQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading book...</p>;
  }

  if (bookQuery.isError || !bookQuery.data) {
    return <p className="text-sm text-destructive">Unable to load book.</p>;
  }

  const book = bookQuery.data;
  const availability =
    !isStaff && myReservationsQuery.isSuccess
      ? getBookAvailability(book, activeReservation)
      : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CatalogPageHeader
          title={book.title}
          description={
            isStaff
              ? `${book.total_copies} copies · ${book.available_copies} available`
              : undefined
          }
        />
        <div className="flex gap-2">
          {isStaff ? (
            <Button variant="outline" asChild>
              <Link to={`/catalog/books/${book.id}/edit`}>Edit book</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/catalog/books">Back to books</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">ISBN</dt>
              <dd className="mt-1">{book.isbn ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Edition</dt>
              <dd className="mt-1">{book.edition ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Publisher</dt>
              <dd className="mt-1">{book.publisher?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Language</dt>
              <dd className="mt-1">
                {book.language ? `${book.language.name} (${book.language.code})` : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Publication year</dt>
              <dd className="mt-1">{book.publication_year ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Digital</dt>
              <dd className="mt-1">{book.is_digital ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Authors</dt>
              <dd className="mt-1">
                {book.authors?.length
                  ? book.authors.map((author) => author.name).join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Categories</dt>
              <dd className="mt-1">
                {book.categories?.length
                  ? book.categories.map((category) => category.name).join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-muted-foreground">Description</dt>
              <dd className="mt-1">{book.description ?? "—"}</dd>
            </div>
            {isStaff ? (
              <>
                <div>
                  <dt className="font-medium text-muted-foreground">Copy count</dt>
                  <dd className="mt-1">{book.copy_count}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Total / Available</dt>
                  <dd className="mt-1">
                    {book.total_copies} / {book.available_copies}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {!isStaff && book.total_copies > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myReservationsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading reservation status...</p>
            ) : myReservationsQuery.isError ? (
              <p className="text-sm text-destructive">Unable to load your reservations.</p>
            ) : availability ? (
              <>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-muted-foreground">Total copies</dt>
                <dd className="mt-1">{book.total_copies}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Available copies</dt>
                <dd className="mt-1">{book.available_copies}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Availability status</dt>
                <dd className="mt-1">
                  <StatusBadge label={availability.status} variant={availability.statusVariant} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Reservation eligibility</dt>
                <dd className="mt-1">{availability.reservationEligibility}</dd>
              </div>
            </dl>

            {reservationError ? (
              <p className="text-sm text-destructive">{reservationError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {availability.canReserve ? (
                <Button
                  disabled={reserveMutation.isPending}
                  onClick={() => {
                    setReservationError(null);
                    reserveMutation.mutate();
                  }}
                >
                  {reserveMutation.isPending ? "Reserving..." : "Reserve book"}
                </Button>
              ) : null}
              {activeReservation || availability.canReserve ? (
                <Button variant="outline" asChild>
                  <Link to="/circulation/my-reservations">My reservations</Link>
                </Button>
              ) : null}
            </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isStaff ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Physical copies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                setCopyError(null);
                createCopyMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="copy-inventory-code">Inventory code</Label>
                <Input
                  id="copy-inventory-code"
                  value={inventoryCode}
                  onChange={(event) => setInventoryCode(event.target.value)}
                  placeholder="Leave blank to auto-generate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copy-location">Location</Label>
                <Input
                  id="copy-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createCopyMutation.isPending}>
                  {createCopyMutation.isPending ? "Adding..." : "Add copy"}
                </Button>
              </div>
            </form>
            {copyError ? <p className="text-sm text-destructive">{copyError}</p> : null}

            {copiesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading copies...</p>
            ) : copiesQuery.isError ? (
              <p className="text-sm text-destructive">Unable to load copies.</p>
            ) : (
              <CatalogTable>
                <CatalogTableHead columns={["Inventory code", "Location", "Status", "Acquired"]} />
                <tbody>
                  {copiesQuery.data?.length ? (
                    copiesQuery.data.map((copy) => (
                      <tr key={copy.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-medium">{copy.inventory_code}</td>
                        <td className="px-4 py-3">{copy.location ?? "—"}</td>
                        <td className="px-4 py-3">
                          <CopyStatusCell copy={copy} bookId={book.id} onError={setCopyError} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {copy.acquired_date
                            ? new Date(copy.acquired_date).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No copies yet. Add the first physical copy above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </CatalogTable>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
