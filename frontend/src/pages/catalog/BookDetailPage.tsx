import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsStaff } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { getApiErrorMessage } from "@/lib/apiError";
import { createBookCopy, getBook, listBookCopies, updateBookCopy } from "@/services/catalog";
import type { BookCopy, BookCopyStatus } from "@/types/catalog";
import { STAFF_MANAGEABLE_COPY_STATUSES } from "@/types/catalog";
import { createReservation, listMyReservations } from "@/services/circulation";
import type { Book } from "@/types/catalog";
import type { Reservation } from "@/types/circulation";
import { BookRatingCard } from "@/pages/catalog/components/BookRatingCard";
import { BookCoverImage } from "@/pages/catalog/components/BookCoverImage";
import { BookCopyQrCodeAction } from "@/pages/catalog/components/BookCopyQrCodeAction";
import { DigitalResourcePanel } from "@/pages/catalog/components/DigitalResourcePanel";
import {
  CatalogRecordCard,
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
    if (copy.status === "BORROWED") {
      return (
        <Link
          to="/circulation/loans"
          state={{ search: copy.inventory_code }}
          aria-label={`View active loan for copy ${copy.inventory_code}`}
          className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BookCopyStatusBadge status={copy.status} />
        </Link>
      );
    }
    return <BookCopyStatusBadge status={copy.status} />;
  }

  return (
    <Select
      value={copy.status}
      disabled={updateStatusMutation.isPending}
      onValueChange={(value) => updateStatusMutation.mutate(value as BookCopyStatus)}
    >
      <SelectTrigger aria-label="Copy status" className="h-8 w-36 px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAFF_MANAGEABLE_COPY_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const [editingCopy, setEditingCopy] = useState<BookCopy | null>(null);
  const [editLocation, setEditLocation] = useState("");
  const [editAcquiredDate, setEditAcquiredDate] = useState("");
  const [qrPrintLabels, setQrPrintLabels] = useState<Array<{ copy: BookCopy; image: string }>>([]);

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

  async function printQrLabels(copies: BookCopy[]) {
    try {
      const labels = await Promise.all(copies.map(async (copy) => ({
        copy,
        image: await QRCode.toDataURL(copy.qr_code_value, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
        }),
      })));
      setQrPrintLabels(labels);
    } catch {
      setCopyError("Unable to prepare QR labels for printing.");
    }
  }

  useEffect(() => {
    if (!qrPrintLabels.length) return;
    const printTimer = window.setTimeout(() => window.print(), 250);
    const clearLabels = () => setQrPrintLabels([]);
    window.addEventListener("afterprint", clearLabels, { once: true });
    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", clearLabels);
    };
  }, [qrPrintLabels]);

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

  const updateCopyMutation = useMutation({
    mutationFn: () => updateBookCopy(editingCopy!.id, {
      location: editLocation.trim() || null,
      acquired_date: editAcquiredDate || null,
    }),
    onSuccess: () => {
      appToast.updated("Book copy");
      setEditingCopy(null);
      setCopyError(null);
      queryClient.invalidateQueries({ queryKey: ["book-copies", id] });
      queryClient.invalidateQueries({ queryKey: ["books", id] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => setCopyError(getApiErrorMessage(error, "Unable to update book copy.")),
  });

  if (bookQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading book...</p>;
  }

  if (bookQuery.isError || !bookQuery.data) {
    return (
      <QueryErrorState
        message="Unable to load this book."
        onRetry={() => void bookQuery.refetch()}
      />
    );
  }

  const book = bookQuery.data;
  const availability =
    !isStaff && myReservationsQuery.isSuccess
      ? getBookAvailability(book, activeReservation)
      : null;

  return (
    <section className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
        <Link to="/catalog/books">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to catalog
        </Link>
      </Button>

      <Card className="overflow-hidden border-primary/10 bg-[linear-gradient(112deg,oklch(0.97_0.025_149),oklch(0.995_0.012_94)_72%)] py-0">
        <CardContent className="grid gap-0 p-0 lg:grid-cols-[250px_1fr]">
          <div className="flex items-center justify-center bg-secondary/45 p-6 sm:p-8">
            <div className="relative aspect-[3/4] w-40 overflow-hidden rounded-2xl bg-[linear-gradient(145deg,oklch(0.91_0.055_149),oklch(0.96_0.025_94))] text-primary/70 shadow-xl shadow-primary/10 sm:w-48">
              <div className="flex size-full items-center justify-center">
                <BookOpen className="size-14" aria-hidden="true" />
              </div>
              {book.cover_image_url ? (
                <BookCoverImage
                  key={book.cover_image_url}
                  src={book.cover_image_url}
                  title={book.title}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="mb-3 flex flex-wrap gap-2">
              {book.categories?.slice(0, 3).map((category) => (
                <span key={category.id} className="rounded-full border border-primary/10 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
                  {category.name}
                </span>
              ))}
              {book.is_digital ? (
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">Digital</span>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{book.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">
              {book.authors?.map((author) => author.name).join(", ") || "Author not listed"}
            </p>
            <p className="mt-5 max-w-3xl leading-7 text-muted-foreground">
              {book.description || "No description is available for this title yet."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isStaff ? (
                <Button asChild>
                  <Link to={`/catalog/books/${book.id}/edit`}>Edit book details</Link>
                </Button>
              ) : availability ? (
                <StatusBadge
                  label={`${availability.status} · ${book.available_copies} of ${book.total_copies} copies`}
                  variant={availability.statusVariant}
                  className="px-3 py-1.5 text-sm"
                />
              ) : myReservationsQuery.isError ? (
                <StatusBadge label="Availability unavailable" variant="default" />
              ) : (
                <span role="status" className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Checking availability…
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {book.publisher?.name ?? "Publisher not listed"}
                {book.publication_year ? ` · ${book.publication_year}` : ""}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Book details</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ISBN</dt><dd className="mt-1.5 font-medium">{book.isbn ?? "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edition</dt><dd className="mt-1.5 font-medium">{book.edition ?? "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Language</dt><dd className="mt-1.5 font-medium">{book.language ? `${book.language.name} (${book.language.code})` : "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authors</dt><dd className="mt-1.5 font-medium">{book.authors?.map((author) => author.name).join(", ") || "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</dt><dd className="mt-1.5 font-medium">{book.categories?.map((category) => category.name).join(", ") || "—"}</dd></div>
            {isStaff ? (
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventory</dt><dd className="mt-1.5 font-medium">{book.copy_count} copies · {book.available_copies} available</dd></div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <DigitalResourcePanel bookId={book.id} isDigital={book.is_digital} isStaff={isStaff} />

      {!isStaff && book.total_copies > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myReservationsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading reservation status...</p>
            ) : myReservationsQuery.isError ? (
              <QueryErrorState
                message="Unable to load your reservation status."
                onRetry={() => void myReservationsQuery.refetch()}
              />
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

      <BookRatingCard bookId={book.id} allowRating={!isStaff} />

      {isStaff ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Physical copies</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!copiesQuery.data?.length}
                onClick={() => void printQrLabels(copiesQuery.data ?? [])}
              >
                <Printer aria-hidden="true" className="mr-2 size-4" /> Print all labels
              </Button>
            </div>
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
              <QueryErrorState
                message="Unable to load physical copies."
                onRetry={() => void copiesQuery.refetch()}
              />
            ) : (
              <CatalogTable
                mobileContent={(copiesQuery.data ?? []).map((copy) => (
                  <CatalogRecordCard
                    key={copy.id}
                    title={copy.inventory_code}
                    fields={[
                      { label: "Location", value: copy.location ?? "—" },
                      { label: "Status", value: <CopyStatusCell copy={copy} bookId={book.id} onError={setCopyError} /> },
                      { label: "Acquired", value: copy.acquired_date ? new Date(copy.acquired_date).toLocaleDateString() : "—" },
                    ]}
                    actions={(
                      <div className="flex flex-wrap gap-2">
                        <BookCopyQrCodeAction copy={copy} bookTitle={book.title} />
                        <Button variant="outline" size="sm" onClick={() => {
                          setCopyError(null);
                          setEditingCopy(copy);
                          setEditLocation(copy.location ?? "");
                          setEditAcquiredDate(copy.acquired_date ?? "");
                        }}>Edit copy</Button>
                      </div>
                    )}
                  />
                ))}
              >
                <CatalogTableHead columns={["Inventory code", "Location", "Status", "Acquired", "Actions"]} />
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
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                          <BookCopyQrCodeAction copy={copy} bookTitle={book.title} />
                          <Button variant="outline" size="sm" onClick={() => {
                            setCopyError(null);
                            setEditingCopy(copy);
                            setEditLocation(copy.location ?? "");
                            setEditAcquiredDate(copy.acquired_date ?? "");
                          }}>Edit</Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
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
      <Dialog open={editingCopy !== null} onOpenChange={(open) => { if (!open && !updateCopyMutation.isPending) setEditingCopy(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit physical copy</DialogTitle>
            <DialogDescription>Update the location or acquisition date for {editingCopy?.inventory_code}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-copy-location">Location</Label><Input id="edit-copy-location" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-copy-acquired">Acquired date</Label><Input id="edit-copy-acquired" type="date" value={editAcquiredDate} onChange={(event) => setEditAcquiredDate(event.target.value)} /></div>
            {copyError ? <p role="alert" className="text-sm text-destructive">{copyError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={updateCopyMutation.isPending} onClick={() => setEditingCopy(null)}>Cancel</Button>
            <Button disabled={updateCopyMutation.isPending} onClick={() => updateCopyMutation.mutate()}>{updateCopyMutation.isPending ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {qrPrintLabels.length ? (
        createPortal(
          <div className="qr-print-root" aria-hidden="true">
            {qrPrintLabels.map(({ copy, image }) => (
              <article className="qr-print-label" key={copy.id}>
                <img src={image} alt="" />
                <div>
                  <p className="qr-print-title">{book?.title}</p>
                  <p className="qr-print-code">{copy.inventory_code}</p>
                  {copy.location ? <p className="qr-print-location">{copy.location}</p> : null}
                </div>
              </article>
            ))}
          </div>,
          document.body,
        )
      ) : null}
    </section>
  );
}
