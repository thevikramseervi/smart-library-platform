import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyReservationsPage } from "@/pages/circulation/MyReservationsPage";
import { cancelReservation, listMyReservations } from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  cancelReservation: vi.fn(),
  listMyReservations: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  appToast: { cancelled: vi.fn() },
}));

const reservation = {
  id: "reservation-1",
  book_id: "book-1",
  book: { title: "The Test Book" },
  queue_position: 2,
  reservation_date: "2026-11-01T00:00:00Z",
  expiry_date: "2026-11-15T00:00:00Z",
  status: "ACTIVE",
};

describe("MyReservationsPage", () => {
  let hasReservation = true;

  beforeEach(() => {
    hasReservation = true;
    vi.mocked(listMyReservations).mockImplementation(async () =>
      hasReservation ? [reservation] as never : [],
    );
    vi.mocked(cancelReservation).mockImplementation(async () => {
      hasReservation = false;
    });
  });

  it("cancels an active reservation and refreshes the list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyReservationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const mobileCard = await screen.findByRole("article");
    const desktopTable = within(screen.getByRole("region", { name: "Circulation table" }));
    expect(within(mobileCard).getByRole("link", { name: "The Test Book" })).toBeInTheDocument();
    expect(desktopTable.getByRole("link", { name: "The Test Book" })).toBeInTheDocument();
    fireEvent.click(within(mobileCard).getByRole("button", { name: "Cancel reservation" }));
    expect(await screen.findByRole("heading", { name: "Cancel this reservation?" })).toBeInTheDocument();
    expect(screen.getByText(/give up your current queue position/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel reservation" }));

    expect(await screen.findByText("You have no reservations.")).toBeInTheDocument();
    expect(vi.mocked(cancelReservation).mock.calls[0]?.[0]).toBe("reservation-1");
    await waitFor(() => expect(listMyReservations).toHaveBeenCalledTimes(2));

    queryClient.clear();
  });
});
