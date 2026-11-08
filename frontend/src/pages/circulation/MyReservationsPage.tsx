import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  ReservationStatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import { formatDate } from "@/lib/format";
import { cancelReservation, listMyReservations } from "@/services/circulation";
import type { Reservation } from "@/types/circulation";

export function MyReservationsPage() {
  const queryClient = useQueryClient();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: listMyReservations,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      appToast.cancelled("Reservation cancelled");
      setCancelError(null);
      setReservationToCancel(null);
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setCancelError(getApiErrorMessage(error, "Unable to cancel reservation."));
    },
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="My Reservations"
        description="Books you have reserved while waiting for a copy to become available."
      />

      {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reservations...</p>
      ) : isError ? (
        <QueryErrorState message="Unable to load reservations." onRetry={() => void refetch()} />
      ) : data?.length ? (
        <CirculationTable
          mobileContent={data.map((reservation) => (
            <CirculationRecordCard
              key={reservation.id}
              title={(
                <Link to={`/catalog/books/${reservation.book_id}`} className="hover:underline">
                  {reservation.book.title}
                </Link>
              )}
              status={<ReservationStatusBadge status={reservation.status} />}
              fields={[
                { label: "Queue position", value: reservation.queue_position ?? "—" },
                { label: "Reserved", value: formatDate(reservation.reservation_date) },
                { label: "Expires", value: formatDate(reservation.expiry_date) },
              ]}
              action={reservation.status === "ACTIVE" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => setReservationToCancel(reservation)}
                >
                  Cancel reservation
                </Button>
              ) : undefined}
            />
          ))}
        >
          <CirculationTableHead
            columns={["Book", "Queue position", "Reserved", "Expires", "Status", "Actions"]}
          />
          <tbody>
            {data.map((reservation) => (
              <tr key={reservation.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    to={`/catalog/books/${reservation.book_id}`}
                    className="font-medium hover:underline"
                  >
                    {reservation.book.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{reservation.queue_position ?? "—"}</td>
                <td className="px-4 py-3">{formatDate(reservation.reservation_date)}</td>
                <td className="px-4 py-3">{formatDate(reservation.expiry_date)}</td>
                <td className="px-4 py-3">
                  <ReservationStatusBadge status={reservation.status} />
                </td>
                <td className="px-4 py-3">
                  {reservation.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => setReservationToCancel(reservation)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </CirculationTable>
      ) : (
        <EmptyState
          message="You have no reservations."
          actionLabel="Browse Catalog"
          actionTo="/catalog/books"
        />
      )}
      <ConfirmDialog
        open={reservationToCancel !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) setReservationToCancel(null);
        }}
        title="Cancel this reservation?"
        description={
          reservationToCancel
            ? `Cancel your reservation for ${reservationToCancel.book.title}? You will give up your current queue position.`
            : "This will remove your active reservation from the queue."
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
