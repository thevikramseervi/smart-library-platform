import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { listAuditLogs } from "@/services/admin";

vi.mock("@/services/admin", () => ({
  listAuditLogs: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuditLogPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("AuditLogPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows events and applies action and search filters", async () => {
    vi.mocked(listAuditLogs).mockResolvedValue({
      items: [{
        id: "event-1",
        actor_user_id: "admin-1",
        actor_name: "System Admin",
        actor_email: "admin@library.local",
        action: "BOOK_ISSUED",
        entity_type: "TRANSACTION",
        entity_id: "transaction-1",
        summary: 'Issued "Clean Code" (copy ACC-00001) to Abhishek I',
        details: { inventory_code: "ACC-00001", due_date: "2026-11-23" },
        occurred_at: "2026-11-09T10:00:00Z",
      }],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
    const queryClient = renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText('Issued "Clean Code" (copy ACC-00001) to Abhishek I')).toBeInTheDocument();
    expect(screen.getByText("System Admin")).toBeInTheDocument();
    expect(screen.getByText("Book issued", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.click(await screen.findByRole("option", { name: "Book issued" }));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "ACC-00001" } });
    await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "BOOK_ISSUED",
      q: "ACC-00001",
      page: 1,
    })));
    queryClient.clear();
  });
});
