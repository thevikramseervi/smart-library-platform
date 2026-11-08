import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyFinesPage } from "@/pages/circulation/MyFinesPage";
import { listMyFines } from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  listMyFines: vi.fn(),
}));

describe("MyFinesPage", () => {
  beforeEach(() => {
    vi.mocked(listMyFines).mockResolvedValue([
      {
        id: "fine-unpaid",
        transaction_id: "loan-unpaid",
        student_name: "Student Reader",
        student_code: "STU-1",
        book_title: "Unpaid Book",
        inventory_code: "INV-1",
        due_at: "2026-10-01",
        amount: "12.50",
        reason: "Overdue return",
        paid: false,
        paid_at: null,
        created_at: "2026-10-03T00:00:00Z",
        is_accruing: true,
        is_capped: false,
      },
      {
        id: "fine-capped",
        transaction_id: "loan-capped",
        student_name: "Student Reader",
        student_code: "STU-1",
        book_title: "Capped Book",
        inventory_code: "INV-3",
        due_at: "2026-08-01",
        amount: "500.00",
        reason: "Overdue return",
        paid: false,
        paid_at: null,
        created_at: "2026-08-10T00:00:00Z",
        is_accruing: true,
        is_capped: true,
      },
      {
        id: "fine-paid",
        transaction_id: "loan-paid",
        student_name: "Student Reader",
        student_code: "STU-1",
        book_title: "Paid Book",
        inventory_code: "INV-2",
        due_at: "2026-09-01",
        amount: "50.00",
        reason: "Overdue return",
        paid: true,
        paid_at: "2026-09-10T00:00:00Z",
        created_at: "2026-09-04T00:00:00Z",
        is_accruing: false,
        is_capped: true,
      },
    ] as never);
  });

  it("totals unpaid balances only and explains ongoing accrual", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyFinesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Total outstanding")).toBeInTheDocument();
    expect(screen.getByText(/512\.50/)).toBeInTheDocument();
    const unpaidFineCards = screen.getAllByRole("article").filter((card) =>
      within(card).queryByText("Unpaid Book"),
    );
    expect(unpaidFineCards).toHaveLength(1);
    expect(within(unpaidFineCards[0]).getByText("₹12.50")).toBeInTheDocument();
    const desktopTable = within(screen.getByRole("region", { name: "Circulation table" }));
    expect(within(desktopTable.getByText("Unpaid Book").closest("tr")!).getByText("₹12.50")).toBeInTheDocument();
    expect(screen.getByText(/includes overdue books that have not yet been returned/i)).toBeInTheDocument();
    const cappedFineCard = screen.getAllByRole("article").find((card) =>
      within(card).queryByText("Capped Book"),
    )!;
    expect(within(cappedFineCard).getByText("Maximum fine reached")).toBeInTheDocument();
    expect(desktopTable.getByText("Maximum fine reached")).toBeInTheDocument();

    queryClient.clear();
  });
});
