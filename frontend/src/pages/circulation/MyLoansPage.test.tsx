import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyLoansPage } from "@/pages/circulation/MyLoansPage";
import { listMyActiveTransactions, listMyTransactions, renewLoan } from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  listMyActiveTransactions: vi.fn(),
  listMyTransactions: vi.fn(),
  renewLoan: vi.fn(),
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
  renewal_count: 0,
  max_renewals: 1,
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
    vi.mocked(renewLoan).mockResolvedValue({ ...activeLoan, due_at: "2026-11-29" } as never);
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

    const mobileCard = await screen.findByRole("article");
    const desktopTable = within(screen.getByRole("region", { name: "Active loans" }));
    expect(within(mobileCard).getByRole("link", { name: /20\.00/ })).toHaveAttribute(
      "href",
      "/circulation/my-fines",
    );
    expect(desktopTable.getByRole("link", { name: /20\.00/ })).toHaveAttribute(
      "href",
      "/circulation/my-fines",
    );
    expect(within(mobileCard).getByText("Overdue by 3 days")).toBeInTheDocument();
    expect(desktopTable.getByText("Overdue by 3 days")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Accruing until returned")).toBeInTheDocument();
    expect(desktopTable.getByText("Accruing until returned")).toBeInTheDocument();
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

    const mobileCard = await screen.findByRole("article");
    const desktopTable = within(screen.getByRole("region", { name: "Active loans" }));
    expect(within(mobileCard).getByText("Maximum reached")).toBeInTheDocument();
    expect(desktopTable.getByText("Maximum reached")).toBeInTheDocument();
    expect(screen.queryByText("Accruing until returned")).not.toBeInTheDocument();
    queryClient.clear();
  });

  it("lets a student confirm an eligible loan renewal", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(listMyActiveTransactions).mockResolvedValue([
      { ...activeLoan, is_overdue: false, due_at: "2026-11-20", fine_amount: null },
    ] as never);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyLoansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByRole("article");
    await user.click(within(card).getByRole("button", { name: "Renew book" }));
    await user.click(screen.getByRole("button", { name: "Confirm renewal" }));

    await waitFor(() => expect(renewLoan).toHaveBeenCalledWith("active-1"));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["transactions", "me", "active"],
      }),
    );
    queryClient.clear();
  });
});
