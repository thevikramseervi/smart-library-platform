import { describe, expect, it } from "vitest";

import { buildCirculationReportCsv } from "@/lib/circulationReportCsv";
import type { CirculationReportResponse } from "@/types/dashboard";

const report: CirculationReportResponse = {
  start_date: "2026-11-01",
  end_date: "2026-11-09",
  loans_issued: 18,
  returns_processed: 14,
  overdue_at_period_end: 3,
  fines_collected: "250.00",
  popular_books: [{ book_title: "=SUM(1,1)", loans_issued: 5 }],
  trend_interval: "day",
  trend: [{
    period_start: "2026-11-01",
    loans_issued: 2,
    returns_processed: 1,
    fines_collected: "50.00",
  }],
  reservations_placed: 4,
  reservations_fulfilled: 2,
  reservations_expired: 1,
  reservations_cancelled: 1,
  average_reservation_wait_days: "2.3",
  reservation_trend: [{
    period_start: "2026-11-01",
    reservations_placed: 2,
    reservations_fulfilled: 1,
  }],
  popular_categories: [{ category_name: "=1+1", loans_issued: 8 }],
  on_time_returns: 12,
  late_returns: 2,
  on_time_return_rate_percent: "85.7",
  average_days_late: "4.5",
  overdue_1_7_days_at_period_end: 1,
  overdue_8_30_days_at_period_end: 1,
  overdue_31_plus_days_at_period_end: 1,
  current_unpaid_fine_balance: "780.00",
  current_unpaid_fine_count: 3,
  department_participation: [{
    department_name: "Computer Science",
    active_students: 20,
    borrowing_students: 8,
    participation_rate_percent: "40.0",
    loans_issued: 14,
  }],
  inventory_status: {
    total_copies: 120,
    available_copies: 70,
    borrowed_copies: 35,
    reserved_copies: 5,
    out_of_service_copies: 10,
  },
  reservation_pressure_title_count: 1,
  reservation_pressure_books: [{
    book_title: "Popular Book",
    waiting_reservations: 4,
    available_copies: 1,
    reserved_copies: 2,
    loans_issued: 8,
  }],
  no_loan_title_count: 1,
  no_loan_books: [{ book_title: 'Quiet, "Book"', available_copies: 3 }],
};

describe("buildCirculationReportCsv", () => {
  it("exports the selected report metrics and detail sections as escaped CSV", () => {
    const csv = buildCirculationReportCsv(report);

    expect(csv.startsWith("\uFEFF\"Section\",\"Name\",\"Value\",\"Details\"\r\n")).toBe(true);
    expect(csv).toContain('"Report","Date range","2026-11-01 to 2026-11-09","UTC"');
    expect(csv).toContain('"Circulation","Loans issued","18","Selected period"');
    expect(csv).toContain('"Department participation","Computer Science","8 of 20","40.0% participation; 14 loans"');
    expect(csv).toContain('"Current inventory","Available copies","70",""');
    expect(csv).toContain('"Reservation pressure","Popular Book","4","2 reserved; 1 available; 8 loans in period"');
    expect(csv).toContain('"Available titles with no loans","Quiet, ""Book""","3","Available copies"');
    expect(csv).toContain('"Popular books","1. =SUM(1,1)","5","Loans issued"');
    expect(csv).toContain('"Popular categories","\'=1+1","8","Loans issued"');
    expect(csv).toContain('"Circulation trend","2026-11-01","2","1 returns; 50.00 INR fines collected"');
    expect(csv).toContain('"Reservation trend","2026-11-01","2","1 fulfilled"');
  });
});
