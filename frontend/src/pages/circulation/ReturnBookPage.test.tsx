import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReturnBookPage } from "@/pages/circulation/ReturnBookPage";
import { getReservationQueue, listTransactions, returnBook } from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  getReservationQueue: vi.fn(),
  listTransactions: vi.fn(),
  returnBook: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  appToast: { returned: vi.fn() },
}));

const loan = {
  id: "loan-1",
  book_copy_id: "copy-1",
  due_at: "2026-11-10T00:00:00Z",
  book_copy: {
    id: "copy-1",
    book_id: "book-1",
    inventory_code: "INV-001",
    book: { title: "The Test Book" },
  },
  student: { first_name: "Sam", last_name: "Reader", student_code: "S-001" },
};

describe("ReturnBookPage", () => {
  beforeEach(() => {
    vi.mocked(listTransactions).mockResolvedValue({
      items: [loan],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    } as never);
    vi.mocked(returnBook).mockResolvedValue(loan as never);
    vi.mocked(getReservationQueue).mockRejectedValue(new Error("Queue service unavailable"));
  });

  it("keeps a successful return successful when the queue lookup fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReturnBookPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Return" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Return" }));

    expect(
      await screen.findByText(/book was returned, but its reservation queue could not be checked/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unable to return book.")).not.toBeInTheDocument();
    expect(returnBook).toHaveBeenCalledWith({ book_copy_id: "copy-1" });

    queryClient.clear();
  });

  it("prompts staff to issue the returned copy to the next student in the queue", async () => {
    vi.mocked(getReservationQueue).mockResolvedValue([
      {
        id: "reservation-1",
        book_id: "book-1",
        queue_position: 1,
        reservation_date: "2026-11-01T00:00:00Z",
        expiry_date: "2026-11-15T00:00:00Z",
        status: "ACTIVE",
        student: {
          id: "student-2",
          first_name: "Jane",
          last_name: "Reader",
          email: "jane@campus.edu",
          student_code: "S-002",
        },
      },
    ] as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReturnBookPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Return" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Return" }));

    expect(await screen.findByRole("heading", { name: "Return complete" })).toBeInTheDocument();
    expect(screen.getByText("S-002 - Jane Reader")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Issue Book" })).toHaveAttribute(
      "href",
      "/circulation/issue",
    );

    queryClient.clear();
  });
});
