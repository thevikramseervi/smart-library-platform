import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsPage } from "@/pages/NotificationsPage";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/notifications";

vi.mock("@/services/notifications", () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const notifications = {
  unread_count: 1,
  items: [
    {
      id: "notification-1",
      notification_type: "DUE_SOON" as const,
      title: "Book due soon",
      message: "Clean Code is due tomorrow.",
      link: "/circulation/my-loans",
      created_at: "2026-11-09T08:00:00Z",
      read_at: null,
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.mocked(listNotifications).mockResolvedValue(notifications);
    vi.mocked(markNotificationRead).mockResolvedValue({ ...notifications.items[0], read_at: "2026-11-09T09:00:00Z" });
    vi.mocked(markAllNotificationsRead).mockResolvedValue();
  });

  it("shows notifications and marks one read", async () => {
    const queryClient = renderPage();
    expect(await screen.findByText("Clean Code is due tomorrow.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Book due soon as read" }));
    await waitFor(() => {
      expect(vi.mocked(markNotificationRead).mock.calls[0]?.[0]).toBe("notification-1");
    });
    queryClient.clear();
  });

  it("marks all notifications read", async () => {
    const queryClient = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /mark all as read/i }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
    queryClient.clear();
  });
});
