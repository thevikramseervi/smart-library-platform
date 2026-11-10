import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveLoansPage } from "@/pages/circulation/ActiveLoansPage";
import { getReservationQueue, listTransactions, returnBook } from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  getReservationQueue: vi.fn(),
  listTransactions: vi.fn(),
  returnBook: vi.fn(),
}));

describe("ActiveLoansPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTransactions).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    } as never);
    vi.mocked(getReservationQueue).mockResolvedValue([]);
    vi.mocked(returnBook).mockResolvedValue({} as never);
  });

  it("prefills and applies the inventory code passed from a borrowed copy", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/circulation/loans",
              state: { search: "INV-BOOK-07" },
            },
          ]}
        >
          <ActiveLoansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("Search loans")).toHaveValue("INV-BOOK-07");
    await waitFor(() =>
      expect(listTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ISSUED", q: "INV-BOOK-07" }),
      ),
    );

    queryClient.clear();
  });

  it("filters the unified loans list to overdue loans", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/circulation/loans"]}>
          <ActiveLoansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Overdue" }));
    await waitFor(() => expect(listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ISSUED", overdue: true }),
    ));

    queryClient.clear();
  });

  it.each([
    {
      dueOffsetDays: -2,
      expectedLabel: "Overdue by 2 days",
      expectedClass: "bg-red-100",
    },
    {
      dueOffsetDays: 0,
      expectedLabel: "Due today",
      expectedClass: "bg-amber-100",
    },
    {
      dueOffsetDays: 1,
      expectedLabel: "Due tomorrow",
      expectedClass: "bg-amber-100",
    },
    {
      dueOffsetDays: 4,
      expectedLabel: "Due in 4 days",
      expectedClass: "bg-sky-100",
    },
  ])("shows relative due status: $expectedLabel", async ({ dueOffsetDays, expectedLabel, expectedClass }) => {
    const dueAt = new Date(Date.now() + dueOffsetDays * 86_400_000).toISOString().slice(0, 10);
    vi.mocked(listTransactions).mockResolvedValue({
      items: [{
        id: "loan-1",
        book_copy_id: "copy-1",
        issued_at: "2026-11-01T00:00:00Z",
        due_at: dueAt,
        status: "ISSUED",
        is_overdue: dueOffsetDays < 0,
        fine_amount: dueOffsetDays < 0 ? "20.00" : null,
        book_copy: {
          id: "copy-1",
          inventory_code: "INV-001",
          book_id: "book-1",
          book: { title: "Test title" },
        },
        student: {
          id: "student-1",
          first_name: "Sam",
          last_name: "Reader",
          student_code: "S-001",
        },
      }],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    } as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/circulation/loans"]}>
          <ActiveLoansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const table = await screen.findByRole("region", { name: "Returnable active loans" });
    const status = within(table).getByText(expectedLabel);
    expect(status).toHaveClass(expectedClass);

    queryClient.clear();
  });
});
