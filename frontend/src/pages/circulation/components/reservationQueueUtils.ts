import type { Reservation } from "@/types/circulation";

/** Format a reservation holder as "STU-001 - John Doe". */
export function formatReservationStudentLabel(reservation: Reservation): string {
  const identifier = reservation.student.student_code ?? reservation.student.email ?? reservation.student.id;
  return `${identifier} - ${reservation.student.first_name} ${reservation.student.last_name}`;
}

/** Format a date/time for reservation display. */
export function formatReservationDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
