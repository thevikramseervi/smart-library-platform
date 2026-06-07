import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  StatusBadge,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { cancelReservation, listMyReservations } from "@/services/circulation";

export function MyReservationsPage() {
  const queryClient = useQueryClient();
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: listMyReservations,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      setCancelError(null);
      queryClient.invalidateQueries({ queryKey: ["reservations", "me"] });
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
        <p className="text-sm text-destructive">Unable to load reservations.</p>
      ) : data?.length ? (
        <CirculationTable>
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
                  <StatusBadge label={reservation.status} />
                </td>
                <td className="px-4 py-3">
                  {reservation.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(reservation.id)}
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
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">You have no reservations.</p>
          <Button variant="outline" asChild className="mt-2">
            <Link to="/catalog/books">Browse the catalog to reserve a book</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
