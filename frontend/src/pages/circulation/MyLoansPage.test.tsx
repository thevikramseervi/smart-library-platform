import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyLoansPage } from "@/pages/circulation/MyLoansPage";
import { listMyActiveTransactions, listMyTransactions } from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  listMyActiveTransactions: vi.fn(),
  listMyTransactions: vi.fn(),
}));

const activeLoan = {
  id: "active-1",
  book_copy: { book: { id: "book-1", title: "Still Borrowed" } },
  issued_at: "2026-11-01T00:00:00Z",
  due_at: "2026-11-05",
  returned_at: null,
  status: "ISSUED",
  is_overdue: true,
  fine_amount: "20.00",
  fine_is_capped: false,
};

describe("MyLoansPage", () => {
  beforeEach(() => {
    vi.mocked(listMyActiveTransactions).mockResolvedValue([activeLoan] as never);
    vi.mocked(listMyTransactions).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    } as never);
  });

  it("shows accrued overdue balances and requests returned loans for history", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyLoansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("link", { name: /20\.00/ })).toHaveAttribute(
      "href",
      "/circulation/my-fines",
    );
    expect(await screen.findByText("Overdue by 3 days")).toBeInTheDocument();
    expect(screen.getByText("Accruing until returned")).toBeInTheDocument();
    expect(screen.queryByText("On loan")).not.toBeInTheDocument();
    expect(listMyTransactions).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      status: "RETURNED",
    });

    queryClient.clear();
  });

  it("shows when an overdue fine has reached the maximum", async () => {
    vi.mocked(listMyActiveTransactions).mockResolvedValue([
      { ...activeLoan, fine_amount: "500.00", fine_is_capped: true },
    ] as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyLoansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Maximum reached")).toBeInTheDocument();
    expect(screen.queryByText("Accruing until returned")).not.toBeInTheDocument();
    queryClient.clear();
  });
});
