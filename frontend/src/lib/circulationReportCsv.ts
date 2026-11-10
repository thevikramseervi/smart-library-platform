import type { CirculationReportResponse } from "@/types/dashboard";

type CsvRow = [section: string, name: string, value: string | number, details?: string];

function csvCell(value: string | number | undefined): string {
  let text = value === undefined ? "" : String(value);
  // Prevent spreadsheet applications from interpreting exported text as a formula.
  if (typeof value === "string" && /^[=+@-]/.test(text.trimStart())) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

/** Build a spreadsheet-friendly CSV containing all data shown in Library Analytics. */
export function buildCirculationReportCsv(report: CirculationReportResponse): string {
  const rows: CsvRow[] = [
    ["Report", "Date range", `${report.start_date} to ${report.end_date}`, "UTC"],
    ["Circulation", "Loans issued", report.loans_issued, "Selected period"],
    ["Circulation", "Returns processed", report.returns_processed, "Selected period"],
    ["Circulation", "Overdue at period end", report.overdue_at_period_end, "Point-in-time count"],
    ["Circulation", "Fines collected", report.fines_collected, "Selected period; INR"],
    ["Returns", "On-time returns", report.on_time_returns],
    ["Returns", "Late returns", report.late_returns],
    ["Returns", "On-time return rate", report.on_time_return_rate_percent ?? "—", "Percent"],
    ["Returns", "Average days late", report.average_days_late ?? "—"],
    ["Returns", "Overdue 1–7 days at period end", report.overdue_1_7_days_at_period_end],
    ["Returns", "Overdue 8–30 days at period end", report.overdue_8_30_days_at_period_end],
    ["Returns", "Overdue 31+ days at period end", report.overdue_31_plus_days_at_period_end],
    ["Fines", "Current unpaid fine balance", report.current_unpaid_fine_balance, "INR; current value"],
    ["Fines", "Current unpaid fine records", report.current_unpaid_fine_count, "Current value"],
    ["Reservations", "Placed", report.reservations_placed, "Selected period"],
    ["Reservations", "Fulfilled", report.reservations_fulfilled, "Selected period"],
    ["Reservations", "Expired", report.reservations_expired, "Selected period"],
    ["Reservations", "Cancelled", report.reservations_cancelled, "Selected period"],
    ["Reservations", "Average wait to fulfillment (days)", report.average_reservation_wait_days ?? "—"],
  ];

  for (const [index, book] of report.popular_books.entries()) {
    rows.push(["Popular books", `${index + 1}. ${book.book_title}`, book.loans_issued, "Loans issued"]);
  }
  for (const category of report.popular_categories) {
    rows.push(["Popular categories", category.category_name, category.loans_issued, "Loans issued"]);
  }
  for (const department of report.department_participation) {
    rows.push([
      "Department participation",
      department.department_name,
      `${department.borrowing_students} of ${department.active_students}`,
      `${department.participation_rate_percent}% participation; ${department.loans_issued} loans`,
    ]);
  }

  rows.push(
    ["Current inventory", "Total copies", report.inventory_status.total_copies],
    ["Current inventory", "Available copies", report.inventory_status.available_copies],
    ["Current inventory", "Borrowed copies", report.inventory_status.borrowed_copies],
    ["Current inventory", "Reserved copies", report.inventory_status.reserved_copies],
    ["Current inventory", "Out-of-service copies", report.inventory_status.out_of_service_copies],
  );
  for (const book of report.reservation_pressure_books) {
    rows.push([
      "Reservation pressure",
      book.book_title,
      book.waiting_reservations,
      `${book.reserved_copies} reserved; ${book.available_copies} available; ${book.loans_issued} loans in period`,
    ]);
  }
  rows.push(["Reservation pressure", "Matching title count", report.reservation_pressure_title_count]);
  for (const book of report.no_loan_books) {
    rows.push(["Available titles with no loans", book.book_title, book.available_copies, "Available copies"]);
  }
  rows.push(["Available titles with no loans", "Matching title count", report.no_loan_title_count]);

  for (const point of report.trend) {
    rows.push([
      "Circulation trend",
      point.period_start,
      point.loans_issued,
      `${point.returns_processed} returns; ${point.fines_collected} INR fines collected`,
    ]);
  }
  for (const point of report.reservation_trend) {
    rows.push([
      "Reservation trend",
      point.period_start,
      point.reservations_placed,
      `${point.reservations_fulfilled} fulfilled`,
    ]);
  }

  const csvRows: CsvRow[] = [["Section", "Name", "Value", "Details"], ...rows];
  return `\uFEFF${csvRows
    .map((row) => [row[0], row[1], row[2], row[3] ?? ""].map(csvCell).join(","))
    .join("\r\n")}\r\n`;
}
