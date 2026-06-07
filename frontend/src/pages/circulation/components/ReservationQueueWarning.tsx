import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatReservationDate,
  formatReservationStudentLabel,
} from "@/pages/circulation/components/reservationQueueUtils";
import type { Reservation } from "@/types/circulation";

interface ReservationQueueWarningProps {
  queue: Reservation[];
  bookTitle: string;
  previewLimit?: number;
}

export function ReservationQueueWarning({
  queue,
  bookTitle,
  previewLimit = 5,
}: ReservationQueueWarningProps) {
  if (!queue.length) {
    return null;
  }

  const next = queue[0];
  const preview = queue.slice(0, previewLimit);

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-amber-950">⚠ Reservation Queue Exists</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-amber-950">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-amber-900/80">Book</dt>
            <dd className="mt-1">{bookTitle}</dd>
          </div>
          <div>
            <dt className="font-medium text-amber-900/80">Queue length</dt>
            <dd className="mt-1">{queue.length}</dd>
          </div>
          <div>
            <dt className="font-medium text-amber-900/80">Next student</dt>
            <dd className="mt-1">{formatReservationStudentLabel(next)}</dd>
          </div>
          <div>
            <dt className="font-medium text-amber-900/80">Reservation date</dt>
            <dd className="mt-1">{formatReservationDate(next.reservation_date)}</dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 font-medium text-amber-900/80">Queue preview</p>
          <ol className="list-decimal space-y-1 pl-5">
            {preview.map((reservation) => (
              <li key={reservation.id}>{formatReservationStudentLabel(reservation)}</li>
            ))}
          </ol>
          {queue.length > preview.length ? (
            <p className="mt-2 text-xs text-amber-900/70">
              + {queue.length - preview.length} more in queue
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface ReturnReservationNoticeProps {
  queue: Reservation[];
  bookTitle: string;
  bookId: string;
  copyId: string;
  onClose: () => void;
}

export function ReturnReservationNoticeActions({
  queue,
  bookTitle,
  bookId,
  copyId,
  onClose,
}: ReturnReservationNoticeProps) {
  const next = queue[0];

  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium text-emerald-700">Book returned successfully.</p>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <p className="font-semibold">⚠ Active Reservation Queue Exists</p>
        <dl className="mt-3 grid gap-3">
          <div>
            <dt className="font-medium text-amber-900/80">Book</dt>
            <dd className="mt-1">{bookTitle}</dd>
          </div>
          <div>
            <dt className="font-medium text-amber-900/80">Next student</dt>
            <dd className="mt-1">{formatReservationStudentLabel(next)}</dd>
          </div>
          <div>
            <dt className="font-medium text-amber-900/80">Queue position</dt>
            <dd className="mt-1">
              {next.queue_position ?? 1} of {queue.length}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-amber-900/80">Reserved on</dt>
            <dd className="mt-1">{formatReservationDate(next.reservation_date)}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link
            to="/circulation/reservations"
            state={{ bookId, bookTitle }}
            onClick={onClose}
          >
            View Queue
          </Link>
        </Button>
        <Button asChild>
          <Link
            to="/circulation/issue"
            state={{
              bookId,
              copyId,
              studentId: next.student.id,
            }}
            onClick={onClose}
          >
            Issue Book
          </Link>
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
