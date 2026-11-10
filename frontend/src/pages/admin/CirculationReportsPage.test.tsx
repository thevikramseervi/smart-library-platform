import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CirculationReportsPage } from "@/pages/admin/CirculationReportsPage";
import { getCirculationReport } from "@/services/dashboard";

vi.mock("@/services/dashboard", () => ({
  getCirculationReport: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CirculationReportsPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("CirculationReportsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows report totals and fetches the selected date range", async () => {
    const user = userEvent.setup();
    vi.mocked(getCirculationReport).mockResolvedValue({
      start_date: "2026-11-01",
      end_date: "2026-11-09",
      loans_issued: 18,
      returns_processed: 14,
      overdue_at_period_end: 3,
      fines_collected: "250.00",
      popular_books: [{ book_title: "Example Book", loans_issued: 5 }],
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
      popular_categories: [{ category_name: "Computer Science", loans_issued: 8 }],
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
      no_loan_books: [{ book_title: "Quiet Book", available_copies: 3 }],
    });
    const queryClient = renderPage();

    expect(await screen.findByText("Overdue at period end")).toBeInTheDocument();
    expect(screen.getAllByText("Loans issued")).toHaveLength(2);
    expect(screen.getAllByText("Returns processed")).toHaveLength(2);
    expect(screen.getByText("Fines collected")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Loans issued and returns processed trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fines collected trend" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Circulation" }));
    expect(screen.getByRole("tab", { name: "Circulation" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("On-time return rate")).toBeInTheDocument();
    expect(screen.getByText("Current unpaid fines")).toBeInTheDocument();
    expect(screen.getByText("Overdue age at period end")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Reservations" }));
    expect(await screen.findByRole("img", { name: "Reservations placed and fulfilled trend" })).toBeInTheDocument();
    expect(await screen.findByText("Average wait to fulfillment")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Collection" }));
    expect(await screen.findByText("Example Book")).toBeInTheDocument();
    expect(screen.getAllByText("Computer Science")).toHaveLength(2);
    expect(screen.getByRole("progressbar", { name: "Computer Science borrowing participation" })).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("Collection health")).toBeInTheDocument();
    expect(screen.getByText("Current copy status")).toBeInTheDocument();
    expect(screen.getByText("Reservation pressure")).toBeInTheDocument();
    expect(screen.getByText("Popular Book")).toBeInTheDocument();
    expect(screen.getByText("Available titles with no loans")).toBeInTheDocument();
    expect(screen.getByText("Quiet Book")).toBeInTheDocument();
    const createObjectUrl = vi.fn(() => "blob:analytics-report");
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: vi.fn(),
    });
    let downloadedFilename = "";
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFilename = this.download;
      });
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(createObjectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: "text/csv;charset=utf-8" }),
    );
    expect(downloadedFilename).toBe("library-analytics_2026-11-01_2026-11-09.csv");
    anchorClick.mockRestore();
    vi.unstubAllGlobals();
    await waitFor(() => expect(getCirculationReport).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    ));

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-09" } });
    await waitFor(() =>
      expect(getCirculationReport).toHaveBeenLastCalledWith("2026-11-01", "2026-11-09"),
    );
    queryClient.clear();
  });

  it("does not request a report for an invalid date range", async () => {
    const tomorrowDate = new Date();
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    vi.mocked(getCirculationReport).mockResolvedValue({
      start_date: "2026-11-01",
      end_date: "2026-11-09",
      loans_issued: 0,
      returns_processed: 0,
      overdue_at_period_end: 0,
      fines_collected: "0.00",
      popular_books: [],
      trend_interval: "day",
      trend: [],
      reservations_placed: 0,
      reservations_fulfilled: 0,
      reservations_expired: 0,
      reservations_cancelled: 0,
      average_reservation_wait_days: null,
      reservation_trend: [],
      popular_categories: [],
      on_time_returns: 0,
      late_returns: 0,
      on_time_return_rate_percent: null,
      average_days_late: null,
      overdue_1_7_days_at_period_end: 0,
      overdue_8_30_days_at_period_end: 0,
      overdue_31_plus_days_at_period_end: 0,
      current_unpaid_fine_balance: "0.00",
      current_unpaid_fine_count: 0,
      department_participation: [],
      inventory_status: {
        total_copies: 0,
        available_copies: 0,
        borrowed_copies: 0,
        reserved_copies: 0,
        out_of_service_copies: 0,
      },
      reservation_pressure_title_count: 0,
      reservation_pressure_books: [],
      no_loan_title_count: 0,
      no_loan_books: [],
    });
    const queryClient = renderPage();

    await waitFor(() => expect(getCirculationReport).toHaveBeenCalled());
    vi.clearAllMocks();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: tomorrow } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The start date must be on or before the end date.",
    );
    expect(getCirculationReport).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
